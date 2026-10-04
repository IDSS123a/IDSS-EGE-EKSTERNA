import type { SubjectCode } from "@/features/knowledge/types";

/** Director Command Center (migration 033, PDL-040). Null means "premalo učenika" (K2). */
export type DirectorTab = "pregled" | "predmeti" | "nastavnici" | "sadrzaj" | "sistem" | "dnevnik";
export type PeriodChoice = "7" | "30" | "90" | "godina";

export type Overview = {
  minGroup: number;
  studentsActive: number;
  studentsPractised: number;
  answers: number | null;
  weeks: { week: string; students: number; answers: number | null }[];
  exams: { requested: number; submitted: number; graded: number };
  assignments: { given: number; recipients: number; states: Record<string, number> | null };
  gifts: number;
};

export type SubjectAggregate = {
  code: SubjectCode;
  trusted: number;
  students: number;
  covered: number | null;
  checked: number | null;
  correct: number | null;
  readiness: Record<string, number> | null;
  examPoints: { points: number; exams: number }[] | null;
  gradedExams: number;
};

export type TeacherActivity = {
  name: string;
  subjects: SubjectCode[];
  recordsReviewed: number;
  rulesReviewed: number;
  answersReviewed: number;
  setsApproved: number;
  examsGraded: number;
  assignmentsGiven: number;
  giftsGiven: number;
  notesWritten: number;
  waitingAnswers: number;
  waitingExams: number;
};

export type ContentHealth = {
  code: SubjectCode;
  records: number;
  accepted: number;
  returned: number;
  textRevisions: number;
  errataOpen: number;
  followUpsOpen: number;
  blueprint: { version: string; loadedAt: string; review: { decision: string; by: string; at: string } | null } | null;
  chunks: number;
  embeddings: number;
  missed: { key: string; wrong: number; students: number }[];
};

export type SystemHealth = {
  jobs: { state: string; profile: string; finishedAt: string | null; pages: number | null }[];
  security: Record<string, number>;
  chunks: number;
  embeddings: number;
  indexBuiltAt: string | null;
  notificationKinds: string | null;
  migrations: { version: string; name: string }[];
};

export type AuditRow = { id: number; at: string; action: string; actor: string | null; entityType: string; entityId: string | null; details: Record<string, unknown>; ip: string | null };
export type AuditPage = { total: number; rows: AuditRow[]; actions: string[]; people: { id: string; name: string }[] };
export type AuditFilter = { action: string | null; person: string | null; from: string | null; to: string | null; page: number };
