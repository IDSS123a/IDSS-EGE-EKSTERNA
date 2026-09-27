import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RegistryFunctionError } from "@/features/canon/repository";
import type { CatalogueRecord } from "@/features/ingestion/types";
import type { Subject } from "@/features/knowledge/types";
import { countStates, reviewState } from "./domain/queue";
import { allTextProposals, normalizeLineBreaks, type QuestionText } from "./domain/text-revision";
import type { AnswerKeyView, QueueItem, RecordForReview, ReviewDecision, SubjectQueue, TextProposalStatus } from "./types";

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

  const nameMap = await names([...new Set([...decisions.map((row) => row.reviewer), ...revisions.map((row) => row.proposed_by), ...textRevisions.map((row) => row.revised_by)])]);
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
 * propose_answer_key_revision (migration 008): the printed key never changes; the revision is a new row.
 * @throws RegistryFunctionError with the database's machine message
 */
export async function proposeKeyRevision(admin: SupabaseClient, input: { actorUserId: string; answerKeyId: string; correctedAnswer: string; reason: string; evidence: string | null; ipAddress: string | null }): Promise<void> {
  const { error } = await admin.rpc("propose_answer_key_revision", {
    p_actor: input.actorUserId,
    p_answer_key_id: input.answerKeyId,
    p_corrected: input.correctedAnswer,
    p_reason: input.reason,
    p_evidence: input.evidence,
    p_ip: input.ipAddress,
  });
  if (error) throw new RegistryFunctionError(error.message);
}

/**
 * revise_question_text (migration 013): the trusted version never changes; the revision is a new row.
 * @throws RegistryFunctionError with the database's machine message
 */
export async function reviseQuestionText(admin: SupabaseClient, input: { actorUserId: string; questionVersionId: string; text: QuestionText; reason: string; evidence: string | null; ipAddress: string | null }): Promise<void> {
  const { error } = await admin.rpc("revise_question_text", {
    p_actor: input.actorUserId,
    p_question_version_id: input.questionVersionId,
    p_content: {
      raw_text: input.text.rawText,
      stem_text: input.text.stemText,
      options: input.text.options.map((option) => ({ label: option.label, text: option.text })),
      scored_items: input.text.scoredItems.map((item) => ({ item_number: item.itemNumber, raw_text: item.rawText })),
    },
    p_reason: input.reason,
    p_evidence: input.evidence,
    p_ip: input.ipAddress,
  });
  if (error) throw new RegistryFunctionError(error.message);
}

/**
 * Prepared text-revision proposals (AMB-19) among the accepted records of a queue, with whether a
 * reviewer already saved a text revision for the question (caller's client, RLS).
 */
export async function textProposalStatus(client: SupabaseClient, items: readonly QueueItem[]): Promise<TextProposalStatus[]> {
  const keys = new Set(allTextProposals().map((proposal) => proposal.record_key));
  const candidates = items.filter((item) => keys.has(item.recordKey) && item.state === "accepted");
  if (candidates.length === 0) return [];
  const versions = await client
    .from("question_versions")
    .select("id, record_id")
    .in("record_id", candidates.map((item) => item.recordId))
    .returns<{ id: string; record_id: number }[]>();
  if (versions.error) throw new Error(`textProposalStatus(versions) failed: ${versions.error.message}`);
  const versionOf = new Map((versions.data ?? []).map((row) => [row.record_id, row.id]));
  const revised = new Set<string>();
  if (versionOf.size > 0) {
    const revisions = await client
      .from("question_text_revisions")
      .select("question_version_id")
      .in("question_version_id", [...versionOf.values()])
      .returns<{ question_version_id: string }[]>();
    if (revisions.error) throw new Error(`textProposalStatus(revisions) failed: ${revisions.error.message}`);
    for (const row of revisions.data ?? []) revised.add(row.question_version_id);
  }
  return candidates
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((item) => {
      const versionId = versionOf.get(item.recordId);
      return { recordId: item.recordId, recordKey: item.recordKey, confirmed: versionId !== undefined && revised.has(versionId) };
    });
}
