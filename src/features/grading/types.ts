import type { ExamStatus, ExamView } from "@/features/exams/types";
import type { SubjectCode } from "@/features/knowledge/types";

/** One catalogue range of a blueprint position: record keys matching `key` whose task number lies in from..to. */
export type BlueprintPool = { key: string; from: number; to: number };

/** One position of a mock exam blueprint (config/exam-blueprints.json, PDL-026). */
export type BlueprintPosition = {
  position: number;
  label?: string;
  format: string;
  scoring: string;
  points: number;
  item_points?: number;
  items?: number;
  part_points?: number;
  pool: BlueprintPool[];
};

/** A subject's blueprint as data with provenance: who checks it, the evidence and the positions. */
export type BlueprintContent = { reviewer: string; evidence: string; distinct_area: boolean; positions: BlueprintPosition[] };

/** Review of a loaded blueprint: a reviewer confirms that it matches the canonical documents (P-15). */
export type BlueprintReview = { decision: "confirmed" | "rejected"; note: string | null; reviewerName: string | null; decidedAt: string };

/** Blueprint state of one subject: what is in the repository and what is loaded and reviewed in the database. */
export type SubjectBlueprint = {
  subjectId: string;
  subjectCode: SubjectCode;
  /** The entry of config/exam-blueprints.json for this subject. */
  config: { version: string; sha256: string; content: BlueprintContent } | null;
  /** The newest loaded version, if any. */
  loaded: { id: string; version: string; sha256: string; loadedAt: string; content: BlueprintContent; reviews: BlueprintReview[] } | null;
};

/** A line of the teacher's queue. */
export type GradingQueueEntry = {
  id: string;
  subjectId: string;
  subjectCode: SubjectCode;
  student: string;
  status: ExamStatus;
  kind: import("@/features/exams/types").TestKind;
  positions: number[] | null;
  sent: boolean;
  createdAt: string;
  submittedAt: string | null;
  autoSubmitted: boolean;
  gradedAt: string | null;
  maxPoints: number;
  totalPoints: number | null;
  units: number;
  ungraded: number;
};

/** A mock exam as staff see it: every question with its printed key, proposals, errata and open follow-ups. */
export type GradingView = ExamView & {
  subjectId: string;
  student: string;
  approvedAt: string | null;
  proposedPoints: Record<string, number | null>;
  followUps: Record<string, { assignee: string; note: string }[]>;
  /** Points by number of correct pairs (rule exam.scoring), null when the subject has no matching tasks. */
  pairsRule: Record<string, number> | null;
};

/** A practice answer waiting for the teacher (migration 021): the question as printed, the answer, printed keys, errata. */
export type PracticeReviewEntry = {
  id: string;
  submittedAt: string;
  student: string;
  subjectCode: SubjectCode;
  question: import("@/features/practice/types").PracticeQuestion;
  responses: { item: number | null; response: string }[];
  keys: { item: number | null; key: string }[];
  errata: { item: number | null; description: string; evidence: string }[];
};

/** What a teacher can send in a subject (PDL-043): the confirmed blueprint's positions and the official duration. */
export type SendOptions = {
  subjectId: string;
  subjectCode: SubjectCode;
  available: boolean;
  minutes: number | null;
  totalPoints: number | null;
  positions: { position: number; format: string; points: number; areas: { id: string; name: string }[] }[];
};

/** One test a teacher sent, with every student's set. */
export type SentTest = {
  id: string;
  subjectCode: SubjectCode;
  kind: import("@/features/exams/types").TestKind;
  positions: number[] | null;
  minutes: number | null;
  note: string | null;
  audience: "all" | "chosen";
  createdAt: string;
  sentBy: string;
  states: Partial<Record<ExamStatus, number>>;
  sets: { id: string; student: string; status: ExamStatus; points: number | null; max: number }[];
};

export type SendTestResult = { success: true; data: { created: number; skipped: string[] } } | { success: false; code: GradingErrorCode };

export type GradingErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "VALIDATION"
  | "NOT_FOUND"
  | "CLOSED"
  | "UNGRADED"
  | "IN_PROGRESS"
  | "NO_BLUEPRINT"
  | "BLUEPRINT_UNFILLABLE"
  | "POINTS_MISMATCH"
  | "VERSION_EXISTS"
  | "NO_CONFIG"
  | "NO_STUDENTS"
  | "UNAVAILABLE";

export type GradingActionResult =
  | { success: true; data: { message: "BLUEPRINT_LOADED" | "BLUEPRINT_CONFIRMED" | "BLUEPRINT_REJECTED" | "SET_APPROVED" | "SET_DISCARDED" | "SET_REPLACED" | "GRADES_SAVED" | "RESULT_CONFIRMED" | "ANSWER_REVIEWED" } }
  | { success: false; code: GradingErrorCode };
