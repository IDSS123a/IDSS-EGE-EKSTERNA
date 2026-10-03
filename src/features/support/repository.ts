import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RegistryFunctionError } from "@/features/canon/repository";
import type { FollowUp, GroupPatterns, NoteKind, NoteVisibility, OverviewStudent, ProfileSubject, Readiness, StudentProfile, SupportNote } from "./types";

/**
 * Support monitoring data (migration 026, A-3). Service-role client after the page or action has authorised the caller;
 * the database functions re-check unscoped students.view_progress (or support_notes.read_write) and write the access
 * audit row for a profile.
 */

async function call<T>(admin: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await admin.rpc(fn, args);
  if (error) throw new RegistryFunctionError(error.message);
  return data as T;
}

const n = (value: unknown): number => Number(value ?? 0);
type RawReadiness = { state: Readiness["state"]; exams: number | string; errors: number | string };
const readiness = (raw: RawReadiness): Readiness => ({ state: raw.state, exams: n(raw.exams), errors: n(raw.errors) });

type RawOverview = {
  person_id: string;
  name: string;
  last_activity: string | null;
  days_7: number;
  days_30: number;
  subjects: { code: OverviewStudent["subjects"][number]["code"]; total: number; answered: number; mastered: number; checked_30: number; correct_30: number; exams: { points: number | string; max: number | string; graded_at: string }[]; open: number; readiness: RawReadiness }[];
};

/** support_overview: every student with indicators per subject. */
export async function supportOverview(admin: SupabaseClient, actorUserId: string): Promise<OverviewStudent[]> {
  const rows = await call<RawOverview[]>(admin, "support_overview", { p_actor: actorUserId });
  return rows.map((row) => ({
    personId: row.person_id,
    name: row.name,
    lastActivity: row.last_activity,
    days7: n(row.days_7),
    days30: n(row.days_30),
    subjects: row.subjects.map((subject) => ({
      code: subject.code,
      total: n(subject.total),
      answered: n(subject.answered),
      mastered: n(subject.mastered),
      checked30: n(subject.checked_30),
      correct30: n(subject.correct_30),
      exams: subject.exams.map((exam) => ({ points: n(exam.points), max: n(exam.max), gradedAt: exam.graded_at })),
      open: n(subject.open),
      readiness: readiness(subject.readiness),
    })),
  }));
}

type RawSubject = {
  code: ProfileSubject["code"];
  total: number; answered: number; checked: number; correct: number; checked_30: number; correct_30: number; mastered: number;
  areas: { area: string; ordinal: number; total: number; answered: number; correct: number }[];
  persistent_errors: { question_version_id: string; record_key: string; wrong: number; last_at: string }[];
  exams: { id: string; status: "submitted" | "graded"; submitted_at: string | null; graded_at: string | null; points: number | string | null; max: number | string; auto: boolean | null; minutes_used: number | null; minutes: number | null; empty_units: number; units: number }[];
  readiness: RawReadiness;
};
type RawProfile = {
  person_id: string; name: string; last_activity: string | null; days: { day: string; answers: number }[]; missions_30: number; today: string;
  subjects: RawSubject[];
  notes: { id: string; kind: NoteKind | null; body: string; follow_up_on: string | null; visibility: NoteVisibility; created_at: string; author: string; own: boolean }[];
  can_write_notes: boolean; default_visibility: NoteVisibility;
};

/** support_student: one student's profile; the database writes the access audit row. */
export async function studentProfile(admin: SupabaseClient, input: { actorUserId: string; personId: string; missionGoal: number; ipAddress: string | null }): Promise<StudentProfile> {
  const raw = await call<RawProfile>(admin, "support_student", { p_actor: input.actorUserId, p_person: input.personId, p_mission_goal: input.missionGoal, p_ip: input.ipAddress });
  const notes: SupportNote[] = raw.notes.map((note) => ({ id: note.id, kind: note.kind, body: note.body, followUpOn: note.follow_up_on, visibility: note.visibility, createdAt: note.created_at, author: note.author, own: note.own }));
  return {
    personId: raw.person_id,
    name: raw.name,
    lastActivity: raw.last_activity,
    days: raw.days.map((day) => ({ day: day.day, answers: n(day.answers) })),
    missions30: n(raw.missions_30),
    today: raw.today,
    subjects: raw.subjects.map((subject) => ({
      code: subject.code,
      total: n(subject.total), answered: n(subject.answered), checked: n(subject.checked), correct: n(subject.correct),
      checked30: n(subject.checked_30), correct30: n(subject.correct_30), mastered: n(subject.mastered),
      areas: subject.areas.map((area) => ({ area: area.area, ordinal: n(area.ordinal), total: n(area.total), answered: n(area.answered), correct: n(area.correct) })),
      persistentErrors: subject.persistent_errors.map((error) => ({ questionVersionId: error.question_version_id, recordKey: error.record_key, wrong: n(error.wrong), lastAt: error.last_at })),
      exams: subject.exams.map((exam) => ({
        id: exam.id, status: exam.status, submittedAt: exam.submitted_at, gradedAt: exam.graded_at,
        points: exam.points === null ? null : n(exam.points), max: n(exam.max), auto: exam.auto === true,
        minutesUsed: exam.minutes_used === null ? null : n(exam.minutes_used), minutes: exam.minutes === null ? null : n(exam.minutes),
        emptyUnits: n(exam.empty_units), units: n(exam.units),
      })),
      readiness: readiness(subject.readiness),
    })),
    notes,
    canWriteNotes: raw.can_write_notes,
    defaultVisibility: raw.default_visibility,
  };
}

/** support_patterns: aggregates of all students. */
export async function groupPatterns(admin: SupabaseClient, actorUserId: string): Promise<GroupPatterns> {
  const raw = await call<{
    students: number; weeks: { week: string; students: number; answers: number }[];
    areas: { subject: GroupPatterns["areas"][number]["subject"]; area: string; ordinal: number; checked: number; correct: number }[];
    exam_points: { subject: GroupPatterns["examPoints"][number]["subject"]; points: number; exams: number }[];
    missed_questions: { subject: GroupPatterns["missedQuestions"][number]["subject"]; record_key: string; wrong: number; students: number }[];
  }>(admin, "support_patterns", { p_actor: actorUserId });
  return {
    students: n(raw.students),
    weeks: raw.weeks.map((week) => ({ week: week.week, students: n(week.students), answers: n(week.answers) })),
    areas: raw.areas.map((area) => ({ subject: area.subject, area: area.area, ordinal: n(area.ordinal), checked: n(area.checked), correct: n(area.correct) })),
    examPoints: raw.exam_points.map((row) => ({ subject: row.subject, points: n(row.points), exams: n(row.exams) })),
    missedQuestions: raw.missed_questions.map((row) => ({ subject: row.subject, recordKey: row.record_key, wrong: n(row.wrong), students: n(row.students) })),
  };
}

/** support_follow_ups: follow-up dates of notes the caller may read. */
export async function followUps(admin: SupabaseClient, actorUserId: string): Promise<FollowUp[]> {
  const rows = await call<{ person_id: string; student: string; follow_up_on: string; kind: NoteKind | null }[]>(admin, "support_follow_ups", { p_actor: actorUserId });
  return rows.map((row) => ({ personId: row.person_id, student: row.student, followUpOn: row.follow_up_on, kind: row.kind }));
}

/** support_note_add: an append-only note; visibility null takes the role's default (D1). */
export async function addNote(admin: SupabaseClient, input: { actorUserId: string; personId: string; kind: NoteKind | null; body: string; followUpOn: string | null; visibility: NoteVisibility | null; ipAddress: string | null }): Promise<void> {
  await call<string>(admin, "support_note_add", { p_actor: input.actorUserId, p_person: input.personId, p_kind: input.kind, p_body: input.body, p_follow_up: input.followUpOn, p_visibility: input.visibility, p_ip: input.ipAddress });
}
