import type { SubjectCode } from "@/features/knowledge/types";

/** How one item of a practice question is answered (migration 017). */
export type PracticeMode = "choice" | "true_false" | "open";

/** One answerable item: the whole task (item null) or a scored item of a German task. */
export type PracticeItem = { item: number | null; text: string | null; mode: PracticeMode; choices: string[] };

/** A trusted question as the student sees it before answering: never a key or a solution. */
export type PracticeQuestion = {
  questionVersionId: string;
  recordKey: string;
  subjectId: string;
  areaId: string | null;
  area: string | null;
  taskType: string;
  catalogueLevel: string | null;
  text: string;
  stem: string | null;
  options: { label: string; text: string }[];
  hasFigure: boolean;
  items: PracticeItem[];
  /** Official listening transcript (AMB-04 option a), null for other tasks. */
  transcript: string | null;
  source: { page: number | null; officialTitle: string };
  /** The question as printed: public path of its catalogue crop (P-15), null when none exists for this edition. */
  crop: string | null;
  /** Established catalogue errors (migration 020): before answering only which item is affected, never the description. */
  errata: { item: number | null }[];
};

/** An established catalogue error, as shown once the student has answered (P-15: the printed key still counts). */
export type Erratum = { item: number | null; description: string; evidence: string };

export type PracticeOutcome = "correct" | "partly_correct" | "incorrect" | "awaiting_teacher";

/** Result of one submitted answer, with the solution now that the student has answered (PDL-018). */
export type PracticeResult = {
  outcome: PracticeOutcome;
  itemsChecked: number;
  itemsCorrect: number;
  results: { item: number | null; mode: PracticeMode; response: string; correct: boolean | null; solution: string | null }[];
  errata: Erratum[];
};

/** Counts of one area for the Game Hub. */
export type AreaProgress = { subjectId: string; subjectCode: SubjectCode; areaId: string | null; area: string; ordinal: number; total: number; answered: number; correct: number; awaiting: number };

/** Everything the Game Hub shows. */
export type PracticeOverview = { areas: AreaProgress[]; days: string[]; today: number; todayDate: string };

export type PracticeErrorCode = "UNAUTHENTICATED" | "FORBIDDEN" | "VALIDATION" | "NOT_FOUND" | "UNAVAILABLE";

export type PracticeSubmitResult = { success: true; data: PracticeResult } | { success: false; code: PracticeErrorCode };
