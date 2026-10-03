import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RegistryFunctionError } from "@/features/canon/repository";
import type { SubjectCode } from "@/features/knowledge/types";
import { toQuestion, type QuestionRow } from "@/features/practice/repository";
import type { ExamOverview, ExamStatus, ExamUnit, ExamView } from "./types";

/**
 * Mock exam data for students (migrations 019, 022, 023; A-3). Every call uses the service-role client after the page
 * or action has authorised the student; the database binds every exam to the student's person, hides the questions
 * before the start and keys and points until the teacher has graded.
 */

async function call<T>(admin: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await admin.rpc(fn, args);
  if (error) throw new RegistryFunctionError(error.message);
  return data as T;
}

const num = (value: unknown): number | null => (value === null || value === undefined ? null : Number(value));

type UnitRow = {
  id: string;
  position: number;
  sequence: number;
  question_version_id: string;
  item: number | null;
  format: string;
  scoring: ExamUnit["scoring"];
  mode: ExamUnit["mode"];
  max_points: number | string;
  allowed_points: (number | string)[];
  response: string;
  final_points?: number | string | null;
  correct_pairs?: number | null;
  note?: string | null;
  solution?: string | null;
};

type ErratumRow = { item: number | null; description?: string; evidence?: string };

type ViewRow = {
  id: string;
  subject_code: SubjectCode;
  status: ExamStatus;
  created_at: string;
  started_at: string | null;
  deadline_at: string | null;
  submitted_at: string | null;
  auto_submitted: boolean | null;
  graded_at: string | null;
  max_points: number | string;
  minutes: number | null;
  total_points: number | string | null;
  server_now: string;
  items: UnitRow[];
  questions: Record<string, Omit<QuestionRow, "errata"> & { errata?: ErratumRow[] }>;
};

/** The payload of private.mock_exam_payload as the app's ExamView. */
export function toExamView(row: ViewRow): ExamView {
  const questions: ExamView["questions"] = {};
  for (const [id, question] of Object.entries(row.questions ?? {})) {
    questions[id] = {
      ...toQuestion(question),
      errataDetails: (question.errata ?? [])
        .filter((erratum) => typeof erratum.description === "string")
        .map((erratum) => ({ item: erratum.item, description: erratum.description as string, evidence: erratum.evidence ?? "" })),
    };
  }
  return {
    id: row.id,
    subjectCode: row.subject_code,
    status: row.status,
    createdAt: row.created_at,
    startedAt: row.started_at,
    deadlineAt: row.deadline_at,
    submittedAt: row.submitted_at,
    autoSubmitted: row.auto_submitted === true,
    gradedAt: row.graded_at,
    maxPoints: Number(row.max_points),
    minutes: row.minutes,
    totalPoints: num(row.total_points),
    serverNow: row.server_now,
    units: (row.items ?? []).map((unit) => ({
      id: unit.id,
      position: unit.position,
      sequence: unit.sequence,
      questionVersionId: unit.question_version_id,
      item: unit.item,
      format: unit.format,
      scoring: unit.scoring,
      mode: unit.mode,
      maxPoints: Number(unit.max_points),
      allowedPoints: (unit.allowed_points ?? []).map(Number),
      response: unit.response ?? "",
      finalPoints: num(unit.final_points),
      correctPairs: unit.correct_pairs ?? null,
      note: unit.note ?? null,
      solution: unit.solution ?? null,
    })),
    questions,
  };
}

/** mock_exam_overview: subjects with availability and the open exam, and the student's earlier exams. */
export async function examOverview(admin: SupabaseClient, actorUserId: string): Promise<ExamOverview> {
  const raw = await call<{
    subjects: { subject_id: string; subject_code: SubjectCode; available: boolean; minutes: number | null; total_points: number | string | null; open_exam_id: string | null; open_status: ExamStatus | null }[];
    exams: { id: string; subject_code: SubjectCode; status: ExamStatus; created_at: string; submitted_at: string | null; graded_at: string | null; max_points: number | string; total_points: number | string | null }[];
  }>(admin, "mock_exam_overview", { p_actor: actorUserId });
  return {
    subjects: raw.subjects.map((subject) => ({
      subjectId: subject.subject_id,
      subjectCode: subject.subject_code,
      available: subject.available,
      minutes: subject.minutes,
      totalPoints: num(subject.total_points),
      openExamId: subject.open_exam_id,
      openStatus: subject.open_status,
    })),
    exams: raw.exams.map((exam) => ({
      id: exam.id,
      subjectCode: exam.subject_code,
      status: exam.status,
      createdAt: exam.created_at,
      submittedAt: exam.submitted_at,
      gradedAt: exam.graded_at,
      maxPoints: Number(exam.max_points),
      totalPoints: num(exam.total_points),
    })),
  };
}

/** mock_exam_view: the student's own exam (an exam past its deadline is submitted first). */
export async function examView(admin: SupabaseClient, actorUserId: string, examId: string): Promise<ExamView> {
  return toExamView(await call<ViewRow>(admin, "mock_exam_view", { p_actor: actorUserId, p_exam_id: examId }));
}

/** mock_exam_start: the open exam of the subject, or a new set that waits for a teacher. */
export async function requestExam(admin: SupabaseClient, input: { actorUserId: string; subjectId: string; ipAddress: string | null }): Promise<string> {
  return call<string>(admin, "mock_exam_start", { p_actor: input.actorUserId, p_subject_id: input.subjectId, p_ip: input.ipAddress });
}

/** mock_exam_begin: starts an approved set; the official duration runs from now. */
export async function beginExam(admin: SupabaseClient, input: { actorUserId: string; examId: string; ipAddress: string | null }): Promise<void> {
  await call<null>(admin, "mock_exam_begin", { p_actor: input.actorUserId, p_exam_id: input.examId, p_ip: input.ipAddress });
}

type Responses = { id: string; response: string }[];

/** mock_exam_save: stores answers while writing; returns the server clock or that the exam was closed. */
export async function saveExam(admin: SupabaseClient, input: { actorUserId: string; examId: string; responses: Responses }): Promise<{ status: "in_progress"; serverNow: string; deadlineAt: string } | { status: "submitted" }> {
  const raw = await call<{ status: "in_progress" | "submitted"; server_now?: string; deadline_at?: string }>(admin, "mock_exam_save", { p_actor: input.actorUserId, p_exam_id: input.examId, p_responses: input.responses });
  return raw.status === "in_progress" && raw.server_now && raw.deadline_at ? { status: "in_progress", serverNow: raw.server_now, deadlineAt: raw.deadline_at } : { status: "submitted" };
}

/** mock_exam_submit: stores the last answers and submits; pre-scoring runs in the same transaction. */
export async function submitExam(admin: SupabaseClient, input: { actorUserId: string; examId: string; responses: Responses; ipAddress: string | null }): Promise<void> {
  await call<unknown>(admin, "mock_exam_submit", { p_actor: input.actorUserId, p_exam_id: input.examId, p_responses: input.responses, p_ip: input.ipAddress });
}
