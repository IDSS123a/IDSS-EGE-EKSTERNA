import type { SubjectCode } from "@/features/knowledge/types";
import type { PracticeQuestion } from "@/features/practice/types";

/** Life of a mock exam (migration 022): a teacher approves the set before the student starts it. */
export type ExamStatus = "awaiting_approval" | "approved" | "in_progress" | "submitted" | "graded" | "discarded";

export type ExamMode = "choice" | "true_false" | "open";

/** One scored unit of a mock exam: a whole task, a task part or one statement of a German task. */
export type ExamUnit = {
  id: string;
  position: number;
  sequence: number;
  questionVersionId: string;
  item: number | null;
  format: string;
  scoring: "single" | "matching" | "parts" | "per_item";
  mode: ExamMode;
  maxPoints: number;
  allowedPoints: number[];
  response: string;
  /** Released only once the exam is graded. */
  finalPoints: number | null;
  correctPairs: number | null;
  note: string | null;
  solution: string | null;
};

/** A mock exam as the student sees it: no question before the start, results only once graded. */
export type ExamView = {
  id: string;
  subjectCode: SubjectCode;
  status: ExamStatus;
  createdAt: string;
  startedAt: string | null;
  deadlineAt: string | null;
  submittedAt: string | null;
  autoSubmitted: boolean;
  gradedAt: string | null;
  maxPoints: number;
  minutes: number | null;
  totalPoints: number | null;
  serverNow: string;
  units: ExamUnit[];
  /** Questions by version id, as printed (crop) with errata; descriptions once graded. */
  questions: Record<string, PracticeQuestion & { errataDetails: { item: number | null; description: string; evidence: string }[] }>;
};

/** One subject on the exam overview. */
export type ExamSubject = {
  subjectId: string;
  subjectCode: SubjectCode;
  available: boolean;
  minutes: number | null;
  totalPoints: number | null;
  openExamId: string | null;
  openStatus: ExamStatus | null;
};

/** One earlier exam of the student. */
export type ExamSummary = { id: string; subjectCode: SubjectCode; status: ExamStatus; createdAt: string; submittedAt: string | null; gradedAt: string | null; maxPoints: number; totalPoints: number | null };

export type ExamOverview = { subjects: ExamSubject[]; exams: ExamSummary[] };

export type ExamErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "VALIDATION"
  | "NOT_FOUND"
  | "NO_BLUEPRINT"
  | "BLUEPRINT_UNFILLABLE"
  | "NOT_APPROVED"
  | "NO_RULE"
  | "CLOSED"
  | "UNAVAILABLE";

export type ExamActionResult = { success: true } | { success: false; code: ExamErrorCode };

/** Result of an autosave: the server's clock and deadline, or the exam was closed. */
export type ExamSaveResult =
  | { success: true; data: { status: "in_progress"; serverNow: string; deadlineAt: string } | { status: "submitted" } }
  | { success: false; code: ExamErrorCode };
