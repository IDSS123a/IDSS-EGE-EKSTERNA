import type { SubjectCode } from "@/features/knowledge/types";

/** IDSS readiness (PDL-032): an internal indicator from the last three graded mock exams, never an official assessment. */
export type ReadinessState = "not_available" | "100" | "90" | "80" | "below_80";
export type Readiness = { state: ReadinessState; exams: number; errors: number };

/** One subject in the overview table. */
export type OverviewSubject = {
  code: SubjectCode;
  total: number;
  answered: number;
  mastered: number;
  checked30: number;
  correct30: number;
  /** The two most recent graded mock exams, newest first. */
  exams: { points: number; max: number; gradedAt: string }[];
  open: number;
  readiness: Readiness;
};

/** One student in the overview (facts only, no labels). */
export type OverviewStudent = { personId: string; name: string; lastActivity: string | null; days7: number; days30: number; subjects: OverviewSubject[] };

export type NoteKind = "student_talk" | "parent_talk" | "agreement" | "observation";
export type NoteVisibility = "author" | "support";

export type SupportNote = { id: string; kind: NoteKind | null; body: string; followUpOn: string | null; visibility: NoteVisibility; createdAt: string; author: string; own: boolean };

/** An academic teacher note (migration 028, PDL-034): per subject, append-only, never shown to the student. */
export type TeacherNote = { id: string; subject: SubjectCode; body: string; createdAt: string; author: string; own: boolean };

export type ProfileExam = { id: string; status: "submitted" | "graded"; submittedAt: string | null; gradedAt: string | null; points: number | null; max: number; auto: boolean; minutesUsed: number | null; minutes: number | null; emptyUnits: number; units: number };

export type ProfileSubject = {
  code: SubjectCode;
  total: number;
  answered: number;
  checked: number;
  correct: number;
  checked30: number;
  correct30: number;
  mastered: number;
  areas: { area: string; ordinal: number; total: number; answered: number; correct: number }[];
  persistentErrors: { questionVersionId: string; recordKey: string; wrong: number; lastAt: string }[];
  exams: ProfileExam[];
  readiness: Readiness;
};

/** Everything the student profile shows (support_student, migration 026). */
export type StudentProfile = {
  personId: string;
  name: string;
  lastActivity: string | null;
  days: { day: string; answers: number }[];
  /** Null for a subject-scoped reader: the daily mission counts every subject (migration 027). */
  missions30: number | null;
  today: string;
  subjects: ProfileSubject[];
  notes: SupportNote[];
  canWriteNotes: boolean;
  defaultVisibility: NoteVisibility;
};

/** Group analysis: aggregates only. */
export type GroupPatterns = {
  students: number;
  weeks: { week: string; students: number; answers: number }[];
  areas: { subject: SubjectCode; area: string; ordinal: number; checked: number; correct: number }[];
  examPoints: { subject: SubjectCode; points: number; exams: number }[];
  missedQuestions: { subject: SubjectCode; recordKey: string; wrong: number; students: number }[];
};

/** Daily summary of one subject (PDL-018 item 3, migration 027): facts of one day, no threshold, no label. */
export type DailySubject = {
  code: SubjectCode;
  practised: { personId: string; name: string; answers: number; checked: number; correct: number }[];
  notPractised: { personId: string; name: string; lastPractice: string | null }[];
  areas: { area: string; ordinal: number; checked: number; correct: number }[];
  examsSubmitted: number;
  waitingAnswers: number;
  waitingExams: number;
};
export type DailySummary = { day: string; today: string; subjects: DailySubject[] };

export type FollowUp = { personId: string; student: string; followUpOn: string; kind: NoteKind | null };

export type SupportErrorCode = "UNAUTHENTICATED" | "FORBIDDEN" | "VALIDATION" | "NOT_FOUND" | "UNAVAILABLE";
export type SupportActionResult = { success: true; data: { message: "NOTE_ADDED" | "TEACHER_NOTE_ADDED" } } | { success: false; code: SupportErrorCode };
