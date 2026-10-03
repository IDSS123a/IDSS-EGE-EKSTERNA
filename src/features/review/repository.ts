import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RegistryFunctionError } from "@/features/canon/repository";
import type { CatalogueRecord } from "@/features/ingestion/types";
import type { Subject } from "@/features/knowledge/types";
import { countStates, reviewState } from "./domain/queue";
import { normalizeLineBreaks, type QuestionText } from "./domain/text-revision";
import type { AnswerKeyView, CanonNotice, ErratumView, FollowUpView, QueueItem, RecordForReview, ReviewDecision, SubjectQueue } from "./types";

/**
 * Database access for the review queue (A-3). Reads use the caller's client (RLS); names of
 * reviewers come from the service role (display names only). Writes go through the migration 008
 * functions with the service-role client after the action has authorised the caller.
 */

/** Upper bound of records read for one queue (a catalogue has at most a few hundred). */
const QUEUE_RECORD_LIMIT = 2000;

type NameLookup = (ids: string[]) => Promise<Map<string, string>>;

async function latestSucceededJob(client: SupabaseClient, versionId: string): Promise<string | null> {
  const { data, error } = await client
    .from("canonical_ingestion_jobs")
    .select("id")
    .eq("version_id", versionId)
    .eq("state", "succeeded")
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (error) throw new Error(`latestSucceededJob failed: ${error.message}`);
  return data?.id ?? null;
}

async function versionStatus(client: SupabaseClient, versionId: string): Promise<string | null> {
  const { data, error } = await client.from("canonical_document_versions").select("status").eq("id", versionId).maybeSingle<{ status: string }>();
  if (error) throw new Error(`versionStatus failed: ${error.message}`);
  return data?.status ?? null;
}

type DecisionRow = { record_id: number; decision: "accepted" | "returned"; task_type: string | null; reason: string | null; reviewer: string; decided_at: string; ingested_records: { record_key: string } };

/** Every decision on records of one version (any job), newest first. */
async function decisionsOfVersion(client: SupabaseClient, versionId: string, recordKey?: string): Promise<DecisionRow[]> {
  let query = client
    .from("record_reviews")
    .select("record_id, decision, task_type, reason, reviewer, decided_at, ingested_records!inner(record_key, version_id)")
    .eq("ingested_records.version_id", versionId);
  if (recordKey) query = query.eq("ingested_records.record_key", recordKey);
  const { data, error } = await query.order("decided_at", { ascending: false }).limit(QUEUE_RECORD_LIMIT).returns<DecisionRow[]>();
  if (error) throw new Error(`decisionsOfVersion failed: ${error.message}`);
  return data ?? [];
}

type QueueRow = { id: number; record_key: string; ordinal: number; record_kind: string; structural_status: QueueItem["structuralStatus"]; task_type: string | null; area: string | null };

/** The review queue of one subject: records of the latest succeeded job of its active catalogue version. */
export async function findSubjectQueue(client: SupabaseClient, subject: Subject): Promise<SubjectQueue> {
  const empty: SubjectQueue = { versionId: null, jobId: null, items: [], counts: { pending: 0, returned: 0, accepted: 0 } };
  if ((await versionStatus(client, subject.sourceVersionId)) !== "active") return empty;
  const jobId = await latestSucceededJob(client, subject.sourceVersionId);
  if (!jobId) return { ...empty, versionId: subject.sourceVersionId };
  const { data, error } = await client
    .from("ingested_records")
    .select("id, record_key, ordinal, record_kind, structural_status, task_type:record->logic->>task_type, area:record->semantics->>area")
    .eq("job_id", jobId)
    .order("ordinal", { ascending: true })
    .limit(QUEUE_RECORD_LIMIT)
    .returns<QueueRow[]>();
  if (error) throw new Error(`findSubjectQueue failed: ${error.message}`);
  const byKey = new Map<string, { decision: "accepted" | "returned"; decidedAt: string }[]>();
  for (const row of await decisionsOfVersion(client, subject.sourceVersionId)) {
    const key = row.ingested_records.record_key;
    byKey.set(key, [...(byKey.get(key) ?? []), { decision: row.decision, decidedAt: row.decided_at }]);
  }
  const items: QueueItem[] = (data ?? []).map((row) => ({
    recordId: row.id,
    recordKey: row.record_key,
    ordinal: row.ordinal,
    recordKind: row.record_kind,
    structuralStatus: row.structural_status,
    taskType: row.task_type,
    area: row.area,
    state: reviewState(byKey.get(row.record_key) ?? []),
  }));
  return { versionId: subject.sourceVersionId, jobId, items, counts: countStates(items) };
}

type RecordRow = { id: number; job_id: string; version_id: string; record_key: string; structural_status: QueueItem["structuralStatus"]; record: CatalogueRecord };
type KeyRow = { id: string; item_number: number | null; printed_answer: string };
type VersionRow = { id: string; raw_text: string; stem_text: string | null; options: { label: string; text: string }[]; scored_items: { item_number: number; raw_text: string }[] };
type TextRevisionRow = { content: { raw_text: string; stem_text: string | null; options: { label: string; text: string }[]; scored_items: { item_number: number; raw_text: string }[] }; reason: string; evidence: string | null; revised_by: string; created_at: string };
type RevisionRow = { answer_key_id: string; corrected_answer: string; reason: string; evidence: string | null; proposed_by: string; created_at: string };

/** Database text fields (version row or revision content) as the app's QuestionText, with \n line breaks. */
function questionText(row: Omit<VersionRow, "id">): QuestionText {
  return {
    rawText: normalizeLineBreaks(row.raw_text),
    stemText: row.stem_text === null ? null : normalizeLineBreaks(row.stem_text),
    options: row.options.map((option) => ({ label: option.label, text: normalizeLineBreaks(option.text) })),
    scoredItems: row.scored_items.map((item) => ({ itemNumber: item.item_number, rawText: normalizeLineBreaks(item.raw_text) })),
  };
}

/**
 * One record with its history and, once accepted, its keys and revisions. The caller checks the
 * subject scope (canReviewSubject) with the returned subjectId before showing anything.
 */
export async function findRecordForReview(client: SupabaseClient, recordId: number, subjects: Subject[], names: NameLookup): Promise<RecordForReview | null> {
  const { data, error } = await client
    .from("ingested_records")
    .select("id, job_id, version_id, record_key, structural_status, record")
    .eq("id", recordId)
    .maybeSingle<RecordRow>();
  if (error) throw new Error(`findRecordForReview failed: ${error.message}`);
  if (!data) return null;
  const subject = subjects.find((candidate) => candidate.code === data.record.subject);
  if (!subject) return null;

  const decisions = await decisionsOfVersion(client, data.version_id, data.record_key);
  const current = (await versionStatus(client, data.version_id)) === "active" && (await latestSucceededJob(client, data.version_id)) === data.job_id;

  // The trusted copy may come from an earlier job of the same version (same record key).
  const accepted = decisions.find((row) => row.decision === "accepted");
  let keys: KeyRow[] = [];
  let revisions: RevisionRow[] = [];
  let versionRow: VersionRow | null = null;
  let textRevisions: TextRevisionRow[] = [];
  let errata: ErratumRow[] = [];
  let followUps: FollowUpRow[] = [];
  if (accepted) {
    const version = await client.from("question_versions").select("id, raw_text, stem_text, options, scored_items").eq("record_id", accepted.record_id).maybeSingle<VersionRow>();
    if (version.error) throw new Error(`findRecordForReview(version) failed: ${version.error.message}`);
    versionRow = version.data;
    if (version.data) {
      const textResult = await client
        .from("question_text_revisions")
        .select("content, reason, evidence, revised_by, created_at")
        .eq("question_version_id", version.data.id)
        .order("created_at", { ascending: false })
        .returns<TextRevisionRow[]>();
      if (textResult.error) throw new Error(`findRecordForReview(text revisions) failed: ${textResult.error.message}`);
      textRevisions = textResult.data ?? [];
      [errata, followUps] = await Promise.all([errataOf(client, version.data.id), followUpsOf(client, version.data.id)]);
      const keyResult = await client.from("answer_keys").select("id, item_number, printed_answer").eq("question_version_id", version.data.id).order("item_number", { ascending: true, nullsFirst: true }).returns<KeyRow[]>();
      if (keyResult.error) throw new Error(`findRecordForReview(keys) failed: ${keyResult.error.message}`);
      keys = keyResult.data ?? [];
      if (keys.length > 0) {
        const revisionResult = await client
          .from("answer_key_revisions")
          .select("answer_key_id, corrected_answer, reason, evidence, proposed_by, created_at")
          .in("answer_key_id", keys.map((key) => key.id))
          .order("created_at", { ascending: false })
          .returns<RevisionRow[]>();
        if (revisionResult.error) throw new Error(`findRecordForReview(revisions) failed: ${revisionResult.error.message}`);
        revisions = revisionResult.data ?? [];
      }
    }
  }

  const nameMap = await names([
    ...new Set([
      ...decisions.map((row) => row.reviewer),
      ...revisions.map((row) => row.proposed_by),
      ...textRevisions.map((row) => row.revised_by),
      ...errata.map((row) => row.recorded_by),
      ...followUps.flatMap((row) => [row.opened_by, ...(row.canon_follow_up_resolutions ? [row.canon_follow_up_resolutions.resolved_by] : [])]),
    ]),
  ]);
  const history: ReviewDecision[] = decisions.map((row) => ({ decision: row.decision, taskType: row.task_type, reason: row.reason, reviewerName: nameMap.get(row.reviewer) ?? null, decidedAt: row.decided_at }));
  const answerKeys: AnswerKeyView[] = keys.map((key) => ({
    id: key.id,
    itemNumber: key.item_number,
    printedAnswer: key.printed_answer,
    revisions: revisions
      .filter((revision) => revision.answer_key_id === key.id)
      .map((revision) => ({ correctedAnswer: revision.corrected_answer, reason: revision.reason, evidence: revision.evidence, proposedByName: nameMap.get(revision.proposed_by) ?? null, createdAt: revision.created_at })),
  }));
  return {
    recordId: data.id,
    recordKey: data.record_key,
    versionId: data.version_id,
    subjectId: subject.id,
    structuralStatus: data.structural_status,
    record: data.record,
    state: reviewState(decisions.map((row) => ({ decision: row.decision, decidedAt: row.decided_at }))),
    history,
    answerKeys,
    question: versionRow
      ? {
          versionId: versionRow.id,
          text: questionText(versionRow),
          revisions: textRevisions.map((row) => ({ content: questionText(row.content), reason: row.reason, evidence: row.evidence, revisedByName: nameMap.get(row.revised_by) ?? null, createdAt: row.created_at })),
        }
      : null,
    errata: erratumViews(errata, nameMap),
    followUps: followUpViews(followUps, nameMap),
    current,
  };
}

/** Source file of a version and the subject its document belongs to (caller's client, RLS). */
export async function findSourceForReview(client: SupabaseClient, versionId: string): Promise<{ storagePath: string; sha256: string; subjectId: string | null } | null> {
  const { data, error } = await client
    .from("canonical_document_versions")
    .select("storage_path, sha256, canonical_documents!inner(scope_subject_id)")
    .eq("id", versionId)
    .maybeSingle<{ storage_path: string; sha256: string; canonical_documents: { scope_subject_id: string | null } }>();
  if (error) throw new Error(`findSourceForReview failed: ${error.message}`);
  return data ? { storagePath: data.storage_path, sha256: data.sha256, subjectId: data.canonical_documents.scope_subject_id } : null;
}

/**
 * decide_record_review (migration 008): decision, trusted copy with printed keys, dependency row and audit row in one transaction.
 * @throws RegistryFunctionError with the database's machine message
 */
export async function decideRecord(admin: SupabaseClient, input: { actorUserId: string; recordId: number; decision: "accepted" | "returned"; taskType: string | null; reason: string | null; ipAddress: string | null }): Promise<void> {
  const { error } = await admin.rpc("decide_record_review", {
    p_actor: input.actorUserId,
    p_record_id: input.recordId,
    p_decision: input.decision,
    p_task_type: input.taskType,
    p_reason: input.reason,
    p_ip: input.ipAddress,
  });
  if (error) throw new RegistryFunctionError(error.message);
}

/**
 * record_catalogue_erratum (migration 020): a notice beside the printed task; the task and key never change (P-15).
 * @throws RegistryFunctionError with the database's machine message
 */
export async function recordErratum(admin: SupabaseClient, input: { actorUserId: string; questionVersionId: string; itemNumber: number | null; description: string; evidence: string; ipAddress: string | null }): Promise<void> {
  const { error } = await admin.rpc("record_catalogue_erratum", {
    p_actor: input.actorUserId,
    p_question_version_id: input.questionVersionId,
    p_item: input.itemNumber,
    p_description: input.description,
    p_evidence: input.evidence,
    p_ip: input.ipAddress,
  });
  if (error) throw new RegistryFunctionError(error.message);
}

/**
 * withdraw_catalogue_erratum (migration 020): a new row that cancels the erratum.
 * @throws RegistryFunctionError with the database's machine message
 */
export async function withdrawErratum(admin: SupabaseClient, input: { actorUserId: string; erratumId: string; reason: string; ipAddress: string | null }): Promise<void> {
  const { error } = await admin.rpc("withdraw_catalogue_erratum", { p_actor: input.actorUserId, p_erratum_id: input.erratumId, p_reason: input.reason, p_ip: input.ipAddress });
  if (error) throw new RegistryFunctionError(error.message);
}

/**
 * open_canon_follow_up (migration 020): a named person must still check the question.
 * @throws RegistryFunctionError with the database's machine message
 */
export async function openFollowUp(admin: SupabaseClient, input: { actorUserId: string; questionVersionId: string; assignee: string; note: string; ipAddress: string | null }): Promise<void> {
  const { error } = await admin.rpc("open_canon_follow_up", { p_actor: input.actorUserId, p_question_version_id: input.questionVersionId, p_assignee: input.assignee, p_note: input.note, p_ip: input.ipAddress });
  if (error) throw new RegistryFunctionError(error.message);
}

/**
 * resolve_canon_follow_up (migration 020).
 * @throws RegistryFunctionError with the database's machine message
 */
export async function resolveFollowUp(admin: SupabaseClient, input: { actorUserId: string; followUpId: string; note: string; ipAddress: string | null }): Promise<void> {
  const { error } = await admin.rpc("resolve_canon_follow_up", { p_actor: input.actorUserId, p_follow_up_id: input.followUpId, p_note: input.note, p_ip: input.ipAddress });
  if (error) throw new RegistryFunctionError(error.message);
}

type ErratumRow = { id: string; item_number: number | null; description: string; evidence: string; withdraws: string | null; recorded_by: string; recorded_at: string };
type FollowUpRow = { id: string; assignee: string; note: string; opened_by: string; opened_at: string; canon_follow_up_resolutions: { note: string; resolved_by: string; resolved_at: string } | null };

async function errataOf(client: SupabaseClient, versionId: string): Promise<ErratumRow[]> {
  const { data, error } = await client
    .from("catalogue_errata")
    .select("id, item_number, description, evidence, withdraws, recorded_by, recorded_at")
    .eq("question_version_id", versionId)
    .order("recorded_at", { ascending: false })
    .returns<ErratumRow[]>();
  if (error) throw new Error(`errataOf failed: ${error.message}`);
  return data ?? [];
}

async function followUpsOf(client: SupabaseClient, versionId: string): Promise<FollowUpRow[]> {
  const { data, error } = await client
    .from("canon_follow_ups")
    .select("id, assignee, note, opened_by, opened_at, canon_follow_up_resolutions(note, resolved_by, resolved_at)")
    .eq("question_version_id", versionId)
    .order("opened_at", { ascending: false })
    .returns<FollowUpRow[]>();
  if (error) throw new Error(`followUpsOf failed: ${error.message}`);
  return data ?? [];
}

/** Errata rows as views: withdrawal rows are folded into the erratum they cancel. */
function erratumViews(rows: readonly ErratumRow[], names: Map<string, string>): ErratumView[] {
  const withdrawals = new Map(rows.filter((row) => row.withdraws).map((row) => [row.withdraws as string, row]));
  return rows
    .filter((row) => !row.withdraws)
    .map((row) => {
      const withdrawal = withdrawals.get(row.id);
      return {
        id: row.id,
        itemNumber: row.item_number,
        description: row.description,
        evidence: row.evidence,
        recordedByName: names.get(row.recorded_by) ?? null,
        recordedAt: row.recorded_at,
        withdrawal: withdrawal ? { reason: withdrawal.description, byName: names.get(withdrawal.recorded_by) ?? null, at: withdrawal.recorded_at } : null,
      };
    });
}

function followUpViews(rows: readonly FollowUpRow[], names: Map<string, string>): FollowUpView[] {
  return rows.map((row) => {
    const resolution = row.canon_follow_up_resolutions;
    return {
      id: row.id,
      assignee: row.assignee,
      note: row.note,
      openedByName: names.get(row.opened_by) ?? null,
      openedAt: row.opened_at,
      resolution: resolution ? { note: resolution.note, byName: names.get(resolution.resolved_by) ?? null, at: resolution.resolved_at } : null,
    };
  });
}

type NoticeErratumRow = { id: string; withdraws: string | null; recorded_at: string; question_versions: { record_id: number; ingested_records: { record_key: string } } };
type NoticeFollowUpRow = { assignee: string; opened_at: string; canon_follow_up_resolutions: { follow_up_id: string } | null; question_versions: { record_id: number; ingested_records: { record_key: string } } };

/**
 * Open items of one subject for the queue screen: active errata and open follow-ups, by record key
 * (caller's client, RLS: reviewers of the subject, graders and publishers).
 */
export async function canonNotices(client: SupabaseClient, subjectId: string): Promise<CanonNotice[]> {
  const relation = "question_versions!inner(record_id, ingested_records!inner(record_key))";
  const errata = await client.from("catalogue_errata").select(`id, withdraws, recorded_at, ${relation}`).eq("subject_id", subjectId).returns<NoticeErratumRow[]>();
  if (errata.error) throw new Error(`canonNotices(errata) failed: ${errata.error.message}`);
  const followUps = await client.from("canon_follow_ups").select(`assignee, opened_at, canon_follow_up_resolutions(follow_up_id), ${relation}`).eq("subject_id", subjectId).returns<NoticeFollowUpRow[]>();
  if (followUps.error) throw new Error(`canonNotices(follow-ups) failed: ${followUps.error.message}`);
  const withdrawn = new Set((errata.data ?? []).map((row) => row.withdraws).filter((id): id is string => id !== null));
  const notices: CanonNotice[] = [
    ...(errata.data ?? [])
      .filter((row) => row.withdraws === null && !withdrawn.has(row.id))
      .map((row) => ({ recordId: row.question_versions.record_id, recordKey: row.question_versions.ingested_records.record_key, kind: "erratum" as const, assignee: null, at: row.recorded_at })),
    ...(followUps.data ?? [])
      .filter((row) => row.canon_follow_up_resolutions === null)
      .map((row) => ({ recordId: row.question_versions.record_id, recordKey: row.question_versions.ingested_records.record_key, kind: "follow_up" as const, assignee: row.assignee, at: row.opened_at })),
  ];
  return notices.sort((a, b) => a.recordKey.localeCompare(b.recordKey, "bs", { numeric: true }) || a.kind.localeCompare(b.kind));
}
