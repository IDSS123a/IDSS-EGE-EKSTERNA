import type { CatalogueRecord } from "@/features/ingestion/types";
import type { QuestionText } from "./domain/text-revision";

/** Review state of one catalogue record, derived from its append-only decisions. */
export type ReviewState = "pending" | "returned" | "accepted";
/** Queue filter: one state or everything. */
export type QueueFilter = ReviewState | "all";

/** One line of the review queue. */
export type QueueItem = {
  recordId: number;
  recordKey: string;
  ordinal: number;
  recordKind: string;
  structuralStatus: "passed" | "passed_with_flags" | "failed";
  taskType: string | null;
  area: string | null;
  state: ReviewState;
};

/** The queue of one subject: the latest succeeded job of its active catalogue version. */
export type SubjectQueue = {
  versionId: string | null;
  jobId: string | null;
  items: QueueItem[];
  counts: Record<ReviewState, number>;
};

/** A review decision as shown in the history of a record. */
export type ReviewDecision = {
  decision: "accepted" | "returned";
  taskType: string | null;
  reason: string | null;
  reviewerName: string | null;
  decidedAt: string;
};

/** A printed key with its reviewed corrections, newest first (CF-03). */
export type AnswerKeyView = {
  id: string;
  itemNumber: number | null;
  printedAnswer: string;
  revisions: { correctedAnswer: string; reason: string; evidence: string | null; proposedByName: string | null; createdAt: string }[];
};

/** A reviewed text revision of a trusted question, newest first (AMB-19, PDL-021). */
export type TextRevisionView = { content: QuestionText; reason: string; evidence: string | null; revisedByName: string | null; createdAt: string };

/** The trusted copy of an accepted record: its text as extracted and its reviewed text revisions. */
export type TrustedQuestionView = { versionId: string; text: QuestionText; revisions: TextRevisionView[] };

/** Everything the record screen shows. */
export type RecordForReview = {
  recordId: number;
  recordKey: string;
  versionId: string;
  subjectId: string;
  structuralStatus: QueueItem["structuralStatus"];
  record: CatalogueRecord;
  state: ReviewState;
  history: ReviewDecision[];
  /** Keys of the trusted copy, once accepted. */
  answerKeys: AnswerKeyView[];
  /** The trusted copy with its text revisions, once accepted. */
  question: TrustedQuestionView | null;
  /** False when the record belongs to an older job or version (read only). */
  current: boolean;
};

/** Machine codes of review actions; the UI localises them (AMB-11). */
export type ReviewErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "VALIDATION"
  | "NOT_FOUND"
  | "SUBJECT_MISSING"
  | "STALE_RECORD"
  | "ALREADY_ACCEPTED"
  | "NOT_ACCEPTABLE"
  | "UNAVAILABLE";

/** Standard action result (E-5). */
export type ReviewActionResult =
  | { success: true; data: { message: "ACCEPTED" | "RETURNED" | "KEY_REVISED" | "TEXT_REVISED" } }
  | { success: false; code: ReviewErrorCode };
