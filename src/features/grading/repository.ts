import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RegistryFunctionError } from "@/features/canon/repository";
import { toExamView, type ViewRow } from "@/features/exams/repository";
import { toQuestion, type QuestionRow } from "@/features/practice/repository";
import type { Subject, SubjectCode } from "@/features/knowledge/types";
import { blueprintConfig } from "./blueprint-config";
import type { BlueprintContent, GradingQueueEntry, GradingView, PracticeReviewEntry, SubjectBlueprint } from "./types";

/**
 * Data for teachers (migrations 019, 022, 023; A-3). Reads of blueprints use the caller's client (RLS); queue, exams
 * and every write go through the database functions with the service-role client after the page or action has
 * authorised the caller. The functions re-check the subject scope (exams.grade, canon.review) and write the audit row.
 */

async function call<T>(admin: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await admin.rpc(fn, args);
  if (error) throw new RegistryFunctionError(error.message);
  return data as T;
}

const num = (value: unknown): number | null => (value === null || value === undefined ? null : Number(value));

type BlueprintRow = {
  id: string;
  subject_id: string;
  version: string;
  content: BlueprintContent;
  content_sha256: string;
  loaded_at: string;
  exam_blueprint_reviews: { decision: "confirmed" | "rejected"; note: string | null; reviewer: string; decided_at: string }[];
};

/** Blueprint state per subject: the repository entry and the newest loaded version with its reviews (newest first). */
export async function subjectBlueprints(client: SupabaseClient, subjects: readonly Subject[], names: (ids: string[]) => Promise<Map<string, string>>): Promise<SubjectBlueprint[]> {
  if (subjects.length === 0) return [];
  const { data, error } = await client
    .from("exam_blueprints")
    .select("id, subject_id, version, content, content_sha256, loaded_at, exam_blueprint_reviews(decision, note, reviewer, decided_at)")
    .in("subject_id", subjects.map((subject) => subject.id))
    .order("loaded_at", { ascending: false })
    .returns<BlueprintRow[]>();
  if (error) throw new Error(`subjectBlueprints failed: ${error.message}`);
  const rows = data ?? [];
  const nameMap = await names([...new Set(rows.flatMap((row) => row.exam_blueprint_reviews.map((review) => review.reviewer)))]);
  return subjects.map((subject) => {
    const row = rows.find((candidate) => candidate.subject_id === subject.id);
    return {
      subjectId: subject.id,
      subjectCode: subject.code,
      config: blueprintConfig(subject.code),
      loaded: row
        ? {
            id: row.id,
            version: row.version,
            sha256: row.content_sha256,
            loadedAt: row.loaded_at,
            content: row.content,
            reviews: [...row.exam_blueprint_reviews]
              .sort((a, b) => b.decided_at.localeCompare(a.decided_at))
              .map((review) => ({ decision: review.decision, note: review.note, reviewerName: nameMap.get(review.reviewer) ?? null, decidedAt: review.decided_at })),
          }
        : null,
    };
  });
}

/** load_exam_blueprint (canon.publish): stores a subject's blueprint; points must add up to the confirmed total. */
export async function loadBlueprint(admin: SupabaseClient, input: { actorUserId: string; subjectCode: SubjectCode; version: string; content: BlueprintContent; sha256: string; ipAddress: string | null }): Promise<string> {
  return call<string>(admin, "load_exam_blueprint", { p_actor: input.actorUserId, p_subject_code: input.subjectCode, p_version: input.version, p_content: input.content, p_sha256: input.sha256, p_ip: input.ipAddress });
}

/** review_exam_blueprint (canon.review of the subject): confirmed or rejected with a note. */
export async function reviewBlueprint(admin: SupabaseClient, input: { actorUserId: string; blueprintId: string; decision: "confirmed" | "rejected"; note: string | null; ipAddress: string | null }): Promise<void> {
  await call<null>(admin, "review_exam_blueprint", { p_actor: input.actorUserId, p_blueprint_id: input.blueprintId, p_decision: input.decision, p_note: input.note, p_ip: input.ipAddress });
}

type QueueRow = {
  id: string;
  subject_id: string;
  subject_code: SubjectCode;
  student: string;
  status: GradingQueueEntry["status"];
  created_at: string;
  submitted_at: string | null;
  auto_submitted: boolean | null;
  graded_at: string | null;
  max_points: number | string;
  total_points: number | string | null;
  units: number;
  ungraded: number;
};

/** grading_queue (exams.grade): sets awaiting approval, exams to grade and recently graded ones. */
export async function gradingQueue(admin: SupabaseClient, actorUserId: string): Promise<GradingQueueEntry[]> {
  const rows = await call<QueueRow[]>(admin, "grading_queue", { p_actor: actorUserId });
  return rows.map((row) => ({
    id: row.id,
    subjectId: row.subject_id,
    subjectCode: row.subject_code,
    student: row.student,
    status: row.status,
    createdAt: row.created_at,
    submittedAt: row.submitted_at,
    autoSubmitted: row.auto_submitted === true,
    gradedAt: row.graded_at,
    maxPoints: Number(row.max_points),
    totalPoints: num(row.total_points),
    units: row.units,
    ungraded: row.ungraded,
  }));
}

type StaffViewRow = Omit<ViewRow, "items" | "questions"> & {
  subject_id: string;
  student: string | null;
  approved_at: string | null;
  items: (ViewRow["items"][number] & { proposed_points?: number | string | null })[];
  questions: Record<string, ViewRow["questions"][string] & { follow_ups?: { assignee: string; note: string }[] }>;
};

/** Points by number of correct pairs for matching tasks (rule exam.scoring of the subject's current catalogue). */
async function pairsRule(admin: SupabaseClient, subjectId: string): Promise<Record<string, number> | null> {
  const subject = await admin.from("subjects").select("source_version_id").eq("id", subjectId).maybeSingle<{ source_version_id: string }>();
  if (subject.error) throw new Error(`pairsRule(subject) failed: ${subject.error.message}`);
  if (!subject.data) return null;
  const { data, error } = await admin
    .from("canonical_rules")
    .select("value")
    .eq("subject_id", subjectId)
    .eq("source_version_id", subject.data.source_version_id)
    .eq("rule_code", "exam.scoring")
    .order("loaded_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ value: { matching_points_by_correct_pairs?: Record<string, number | string> } }>();
  if (error) throw new Error(`pairsRule failed: ${error.message}`);
  const rule = data?.value?.matching_points_by_correct_pairs;
  return rule ? Object.fromEntries(Object.entries(rule).map(([pairs, points]) => [pairs, Number(points)])) : null;
}

/** grading_view (exams.grade of the subject): the exam with printed keys, proposals, errata and open follow-ups. */
export async function gradingView(admin: SupabaseClient, actorUserId: string, examId: string): Promise<GradingView> {
  const row = await call<StaffViewRow>(admin, "grading_view", { p_actor: actorUserId, p_exam_id: examId });
  const view = toExamView(row);
  return {
    ...view,
    subjectId: row.subject_id,
    student: row.student ?? "",
    approvedAt: row.approved_at,
    proposedPoints: Object.fromEntries((row.items ?? []).map((unit) => [unit.id, num(unit.proposed_points)])),
    followUps: Object.fromEntries(Object.entries(row.questions ?? {}).map(([id, question]) => [id, question.follow_ups ?? []])),
    pairsRule: await pairsRule(admin, row.subject_id),
  };
}

/** mock_exam_approve: the student may start the set. */
export async function approveSet(admin: SupabaseClient, input: { actorUserId: string; examId: string; ipAddress: string | null }): Promise<void> {
  await call<null>(admin, "mock_exam_approve", { p_actor: input.actorUserId, p_exam_id: input.examId, p_ip: input.ipAddress });
}

/** mock_exam_discard: discards the set with a reason; optionally composes a new set for the same student. */
export async function discardSet(admin: SupabaseClient, input: { actorUserId: string; examId: string; note: string; newSet: boolean; ipAddress: string | null }): Promise<string | null> {
  return call<string | null>(admin, "mock_exam_discard", { p_actor: input.actorUserId, p_exam_id: input.examId, p_note: input.note, p_new: input.newSet, p_ip: input.ipAddress });
}

/** grading_save: points (or correct pairs for matching) and notes per unit; null clears a grade. */
export async function saveGrades(admin: SupabaseClient, input: { actorUserId: string; examId: string; scores: ({ id: string; note: string | null } & ({ points: number | null } | { pairs: number | null }))[]; ipAddress: string | null }): Promise<number> {
  return call<number>(admin, "grading_save", { p_actor: input.actorUserId, p_exam_id: input.examId, p_scores: input.scores, p_ip: input.ipAddress });
}

/** grading_confirm: fixes the result (proposals become final), notifies the student. */
export async function confirmGrades(admin: SupabaseClient, input: { actorUserId: string; examId: string; ipAddress: string | null }): Promise<number> {
  return Number(await call<number | string>(admin, "grading_confirm", { p_actor: input.actorUserId, p_exam_id: input.examId, p_ip: input.ipAddress }));
}

type PracticeReviewRow = {
  id: string;
  submitted_at: string;
  student: string;
  subject_code: SubjectCode;
  responses: { item: number | null; response: string }[];
  question: QuestionRow;
  keys: { item: number | null; key: string }[];
  errata: { item: number | null; description: string; evidence: string }[];
};

/** practice_review_queue (exams.grade): practice answers of the teacher's subjects waiting for a verdict, oldest first. */
export async function practiceReviewQueue(admin: SupabaseClient, actorUserId: string): Promise<PracticeReviewEntry[]> {
  const rows = await call<PracticeReviewRow[]>(admin, "practice_review_queue", { p_actor: actorUserId });
  return rows.map((row) => ({
    id: row.id,
    submittedAt: row.submitted_at,
    student: row.student,
    subjectCode: row.subject_code,
    question: toQuestion(row.question),
    responses: row.responses ?? [],
    keys: row.keys ?? [],
    errata: row.errata ?? [],
  }));
}

/** review_practice_answer: the teacher's verdict on a practice answer (append-only, audited). */
export async function reviewPracticeAnswer(admin: SupabaseClient, input: { actorUserId: string; answerId: string; verdict: "correct" | "partly_correct" | "incorrect"; note: string | null; ipAddress: string | null }): Promise<void> {
  await call<string>(admin, "review_practice_answer", { p_actor: input.actorUserId, p_answer_id: input.answerId, p_verdict: input.verdict, p_note: input.note, p_ip: input.ipAddress });
}
