import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RegistryFunctionError } from "@/features/canon/repository";
import type { CurrentAccount } from "@/features/authentication/types";
import { listSubjects } from "@/features/knowledge/repository";
import type { SubjectCode } from "@/features/knowledge/types";
import { toQuestion, type QuestionRow } from "@/features/practice/repository";
import type { PracticeQuestion } from "@/features/practice/types";
import { supportOverview } from "@/features/support/repository";
import { hasSubjectCapability } from "@/lib/permissions";
import type { AssignmentDetail, AssignmentFacts, AssignmentFormOptions, AssignmentSummary, PersonAssignment, StudentAssignment } from "./types";

/**
 * Teacher assignments (migration 029, PDL-035, A-3). Service-role client after the page or action has authorised the
 * caller; the database functions re-check assignments.manage for the subject, the student's own membership and the
 * reader's progress scope.
 */

async function call<T>(admin: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await admin.rpc(fn, args);
  if (error) throw new RegistryFunctionError(error.message);
  return data as T;
}

const n = (value: unknown): number => Number(value ?? 0);
type RawFacts = { total: number; answered: number; correct: number; completed_at: string | null; state: AssignmentFacts["state"] };
const facts = (raw: RawFacts): AssignmentFacts => ({ total: n(raw.total), answered: n(raw.answered), correct: n(raw.correct), completedAt: raw.completed_at, state: raw.state });

/** assignment_create: returns the new assignment's id. */
export async function createAssignment(admin: SupabaseClient, input: {
  actorUserId: string; subject: SubjectCode; title: string; instruction: string | null; dueAt: string;
  keys: string[] | null; areaId: string | null; count: number | null; personIds: string[] | null; ipAddress: string | null;
}): Promise<string> {
  return call<string>(admin, "assignment_create", {
    p_actor: input.actorUserId, p_subject: input.subject, p_title: input.title, p_instruction: input.instruction, p_due: input.dueAt,
    p_keys: input.keys, p_area: input.areaId, p_count: input.count, p_persons: input.personIds, p_ip: input.ipAddress,
  });
}

/** assignment_withdraw: append-only withdrawal with a reason. */
export async function withdrawAssignment(admin: SupabaseClient, input: { actorUserId: string; assignmentId: string; reason: string; ipAddress: string | null }): Promise<void> {
  await call<null>(admin, "assignment_withdraw", { p_actor: input.actorUserId, p_assignment: input.assignmentId, p_reason: input.reason, p_ip: input.ipAddress });
}

/** assignments_overview: the caller's subjects, newest first. */
export async function assignmentsOverview(admin: SupabaseClient, actorUserId: string): Promise<AssignmentSummary[]> {
  const rows = await call<{ id: string; subject: SubjectCode; title: string; due_at: string; created_at: string; audience: "all" | "chosen"; author: string; questions: number; withdrawn: boolean; states: Record<string, number> }[]>(admin, "assignments_overview", { p_actor: actorUserId });
  return rows.map((row) => ({
    id: row.id, subject: row.subject, title: row.title, dueAt: row.due_at, createdAt: row.created_at, audience: row.audience, author: row.author,
    questions: n(row.questions), withdrawn: row.withdrawn, states: Object.fromEntries(Object.entries(row.states).map(([state, count]) => [state, n(count)])),
  }));
}

/** assignment_detail: questions and the facts of every recipient. */
export async function assignmentDetail(admin: SupabaseClient, actorUserId: string, assignmentId: string): Promise<AssignmentDetail> {
  const raw = await call<{
    id: string; subject: SubjectCode; title: string; instruction: string | null; due_at: string; created_at: string; audience: "all" | "chosen"; author: string;
    withdrawal: { reason: string; at: string } | null; questions: { id: string; key: string }[]; recipients: ({ person_id: string; name: string } & RawFacts)[];
  }>(admin, "assignment_detail", { p_actor: actorUserId, p_assignment: assignmentId });
  return {
    id: raw.id, subject: raw.subject, title: raw.title, instruction: raw.instruction, dueAt: raw.due_at, createdAt: raw.created_at, audience: raw.audience,
    author: raw.author, withdrawal: raw.withdrawal, questions: raw.questions,
    recipients: raw.recipients.map((row) => ({ personId: row.person_id, name: row.name, ...facts(row) })),
  };
}

/** assignments_of_person: a student's assignments within the reader's progress scope. */
export async function assignmentsOfPerson(admin: SupabaseClient, actorUserId: string, personId: string): Promise<PersonAssignment[]> {
  const rows = await call<({ id: string; subject: SubjectCode; title: string; due_at: string; author: string } & RawFacts)[]>(admin, "assignments_of_person", { p_actor: actorUserId, p_person: personId });
  return rows.map((row) => ({ id: row.id, subject: row.subject, title: row.title, dueAt: row.due_at, author: row.author, ...facts(row) }));
}

/** student_assignments: the student's own assignments, open ones first. */
export async function studentAssignments(admin: SupabaseClient, actorUserId: string): Promise<StudentAssignment[]> {
  const rows = await call<({ id: string; subject: SubjectCode; title: string; instruction: string | null; due_at: string; teacher: string } & RawFacts)[]>(admin, "student_assignments", { p_actor: actorUserId });
  return rows.map((row) => ({ id: row.id, subject: row.subject, title: row.title, instruction: row.instruction, dueAt: row.due_at, teacher: row.teacher, ...facts(row) }));
}

/** assignment_next: the next question of the assignment not yet answered since it was given; null when complete. */
export async function assignmentNext(admin: SupabaseClient, actorUserId: string, assignmentId: string): Promise<PracticeQuestion | null> {
  const data = await call<QuestionRow | null>(admin, "assignment_next", { p_actor: actorUserId, p_assignment: assignmentId });
  return data ? toQuestion(data) : null;
}

/** The form's options: subjects where the caller manages assignments, their areas, and the active students. */
export async function assignmentFormOptions(admin: SupabaseClient, account: CurrentAccount): Promise<AssignmentFormOptions> {
  const subjects = (await listSubjects(admin)).filter((subject) => hasSubjectCapability(account, "assignments.manage", subject.id));
  const { data, error } = await admin.from("subject_areas").select("id, subject_id, label, ordinal").in("subject_id", subjects.map((subject) => subject.id)).returns<{ id: string; subject_id: string; label: string; ordinal: number }[]>();
  if (error) throw new Error(`assignmentFormOptions failed: ${error.message}`);
  const students = (await supportOverview(admin, account.userId)).map((student) => ({ personId: student.personId, name: student.name }));
  return {
    subjects: subjects.map((subject) => ({
      code: subject.code,
      areas: (data ?? []).filter((area) => area.subject_id === subject.id).sort((a, b) => a.ordinal - b.ordinal).map((area) => ({ id: area.id, label: area.label, ordinal: area.ordinal })),
    })),
    students,
  };
}
