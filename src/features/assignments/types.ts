import type { SubjectCode } from "@/features/knowledge/types";

/** Facts of one recipient (PDL-035 Z3): questions answered since the assignment was given, of them correct, and the state. */
export type AssignmentState = "open" | "complete" | "late" | "missed" | "withdrawn";
export type AssignmentFacts = { total: number; answered: number; correct: number; completedAt: string | null; state: AssignmentState };

/** One assignment in the teacher's list, with the number of recipients per state. */
export type AssignmentSummary = {
  id: string;
  subject: SubjectCode;
  title: string;
  dueAt: string;
  createdAt: string;
  audience: "all" | "chosen";
  author: string;
  questions: number;
  withdrawn: boolean;
  states: Partial<Record<AssignmentState, number>>;
};

export type AssignmentDetail = {
  id: string;
  subject: SubjectCode;
  title: string;
  instruction: string | null;
  dueAt: string;
  createdAt: string;
  audience: "all" | "chosen";
  author: string;
  withdrawal: { reason: string; at: string } | null;
  questions: { id: string; key: string }[];
  recipients: ({ personId: string; name: string } & AssignmentFacts)[];
};

/** An assignment as the student sees it (never withdrawn ones). */
export type StudentAssignment = { id: string; subject: SubjectCode; title: string; instruction: string | null; dueAt: string; teacher: string } & AssignmentFacts;

/** An assignment on a student's profile (support monitoring, mandate §11). */
export type PersonAssignment = { id: string; subject: SubjectCode; title: string; dueAt: string; author: string } & AssignmentFacts;

/** What the teacher's form offers: own subjects with their areas, and the students to choose from. */
export type AssignmentFormOptions = {
  subjects: { code: SubjectCode; areas: { id: string; label: string; ordinal: number }[] }[];
  students: { personId: string; name: string }[];
};

export type AssignmentErrorCode = "UNAUTHENTICATED" | "FORBIDDEN" | "VALIDATION" | "UNKNOWN_KEYS" | "NO_STUDENTS" | "NOT_FOUND" | "ALREADY_WITHDRAWN" | "UNAVAILABLE";
export type AssignmentActionResult = { success: true; data: { message: "CREATED" | "WITHDRAWN"; id: string } } | { success: false; code: AssignmentErrorCode };
