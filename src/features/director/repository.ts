import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RegistryFunctionError } from "@/features/canon/repository";
import type { AuditFilter, AuditPage, ContentHealth, Overview, SubjectAggregate, SystemHealth, TeacherActivity } from "./types";

/**
 * Director Command Center data (migration 033, PDL-040, A-3). Service-role client after the page has authorised the
 * caller; every function re-checks analytics.view_institution (audit.view for the log) and hides figures from fewer
 * students than the minimum group (K2).
 */

async function call<T>(admin: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await admin.rpc(fn, args);
  if (error) throw new RegistryFunctionError(error.message);
  return data as T;
}

const n = (value: unknown): number => Number(value ?? 0);
const orNull = (value: unknown): number | null => (value === null || value === undefined ? null : Number(value));
const counts = (value: Record<string, unknown> | null): Record<string, number> | null =>
  value === null ? null : Object.fromEntries(Object.entries(value).map(([key, count]) => [key, n(count)]));

export async function directorOverview(admin: SupabaseClient, actorUserId: string, since: string): Promise<Overview> {
  const raw = await call<{
    min_group: number; students_active: number; students_practised: number; answers: number | null;
    weeks: { week: string; students: number; answers: number | null }[];
    exams: { requested: number; submitted: number; graded: number };
    assignments: { given: number; recipients: number; states: Record<string, number> | null }; gifts: number;
  }>(admin, "director_overview", { p_actor: actorUserId, p_since: since });
  return {
    minGroup: n(raw.min_group), studentsActive: n(raw.students_active), studentsPractised: n(raw.students_practised), answers: orNull(raw.answers),
    weeks: raw.weeks.map((week) => ({ week: week.week, students: n(week.students), answers: orNull(week.answers) })),
    exams: { requested: n(raw.exams.requested), submitted: n(raw.exams.submitted), graded: n(raw.exams.graded) },
    assignments: { given: n(raw.assignments.given), recipients: n(raw.assignments.recipients), states: counts(raw.assignments.states) },
    gifts: n(raw.gifts),
  };
}

export async function directorSubjects(admin: SupabaseClient, actorUserId: string, since: string): Promise<SubjectAggregate[]> {
  const rows = await call<{ code: SubjectAggregate["code"]; trusted: number; students: number; covered: number | null; checked: number | null; correct: number | null; readiness: Record<string, number> | null; exam_points: { points: number; exams: number }[] | null; graded_exams: number }[]>(
    admin, "director_subjects", { p_actor: actorUserId, p_since: since });
  return rows.map((row) => ({
    code: row.code, trusted: n(row.trusted), students: n(row.students), covered: orNull(row.covered), checked: orNull(row.checked), correct: orNull(row.correct),
    readiness: counts(row.readiness), examPoints: row.exam_points === null ? null : row.exam_points.map((point) => ({ points: n(point.points), exams: n(point.exams) })),
    gradedExams: n(row.graded_exams),
  }));
}

export async function directorTeachers(admin: SupabaseClient, actorUserId: string, since: string): Promise<TeacherActivity[]> {
  const rows = await call<Record<string, unknown>[]>(admin, "director_teachers", { p_actor: actorUserId, p_since: since });
  return rows.map((row) => ({
    name: String(row.name), subjects: row.subjects as TeacherActivity["subjects"],
    recordsReviewed: n(row.records_reviewed), rulesReviewed: n(row.rules_reviewed), answersReviewed: n(row.answers_reviewed), setsApproved: n(row.sets_approved),
    examsGraded: n(row.exams_graded), assignmentsGiven: n(row.assignments_given), giftsGiven: n(row.gifts_given), notesWritten: n(row.notes_written),
    waitingAnswers: n(row.waiting_answers), waitingExams: n(row.waiting_exams),
  }));
}

export async function directorContent(admin: SupabaseClient, actorUserId: string): Promise<ContentHealth[]> {
  const rows = await call<Record<string, unknown>[]>(admin, "director_content", { p_actor: actorUserId });
  return rows.map((row) => {
    const blueprint = row.blueprint as { version: string; loaded_at: string; review: { decision: string; by: string; at: string } | null } | null;
    return {
      code: row.code as ContentHealth["code"], records: n(row.records), accepted: n(row.accepted), returned: n(row.returned), textRevisions: n(row.text_revisions),
      errataOpen: n(row.errata_open), followUpsOpen: n(row.follow_ups_open),
      blueprint: blueprint ? { version: blueprint.version, loadedAt: blueprint.loaded_at, review: blueprint.review } : null,
      chunks: n(row.chunks), embeddings: n(row.embeddings),
      missed: (row.missed as { key: string; wrong: number; students: number }[]).map((miss) => ({ key: miss.key, wrong: n(miss.wrong), students: n(miss.students) })),
    };
  });
}

export async function directorSystem(admin: SupabaseClient, actorUserId: string): Promise<SystemHealth> {
  const raw = await call<{ jobs: { state: string; profile: string; finished_at: string | null; pages: number | null }[]; security: Record<string, number>; chunks: number; embeddings: number; index_built_at: string | null; notification_kinds: string | null; migrations: { version: string; name: string }[] }>(
    admin, "director_system", { p_actor: actorUserId });
  return {
    jobs: raw.jobs.map((job) => ({ state: job.state, profile: job.profile, finishedAt: job.finished_at, pages: orNull(job.pages) })),
    security: counts(raw.security) ?? {}, chunks: n(raw.chunks), embeddings: n(raw.embeddings), indexBuiltAt: raw.index_built_at,
    notificationKinds: raw.notification_kinds, migrations: raw.migrations,
  };
}

/** director_audit: one page of the audit log (or up to `limit` rows for an export), newest first. */
export async function directorAudit(admin: SupabaseClient, actorUserId: string, filter: AuditFilter, limit: number, offset: number): Promise<AuditPage> {
  const nextDay = (day: string) => new Date(Date.parse(`${day}T00:00:00+02:00`) + 86_400_000).toISOString();
  const raw = await call<{ total: number; rows: { id: number; at: string; action: string; actor: string | null; entity_type: string; entity_id: string | null; details: Record<string, unknown>; ip: string | null }[]; actions: string[]; people: { id: string; name: string }[] }>(
    admin, "director_audit", {
      p_actor: actorUserId, p_action: filter.action, p_person: filter.person,
      p_from: filter.from ? new Date(`${filter.from}T00:00:00+02:00`).toISOString() : null,
      p_to: filter.to ? nextDay(filter.to) : null, p_limit: limit, p_offset: offset,
    });
  return {
    total: n(raw.total),
    rows: raw.rows.map((row) => ({ id: n(row.id), at: row.at, action: row.action, actor: row.actor, entityType: row.entity_type, entityId: row.entity_id, details: row.details, ip: row.ip })),
    actions: raw.actions, people: raw.people,
  };
}

/** The first day of the active school year (K3), or null when none is active yet. */
export async function activeSchoolYearStart(admin: SupabaseClient): Promise<string | null> {
  const { data, error } = await admin.from("school_years").select("starts_on").eq("status", "active").order("starts_on", { ascending: false }).limit(1).maybeSingle<{ starts_on: string }>();
  if (error) throw new Error(`activeSchoolYearStart failed: ${error.message}`);
  return data?.starts_on ?? null;
}
