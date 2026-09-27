/** Exam subject codes (Pravilnik Art. 5, P-3); they match the `subject` of ingested records. */
export const SUBJECT_CODES = ["bhs_language_literature", "mathematics", "german"] as const;
export type SubjectCode = (typeof SUBJECT_CODES)[number];

/** An exam subject row (migration 008) with its provenance. */
export type Subject = {
  id: string;
  code: SubjectCode;
  officialName: string;
  legalBasis: string;
  sourceVersionId: string;
  /** Verbatim quotes of the source version backing the subject name. */
  evidence: { page: number; quote: string }[];
};

/** A canonical rule with its evidence and the latest review decision. */
export type CanonicalRule = {
  id: string;
  subjectId: string;
  sourceVersionId: string;
  ruleCode: string;
  value: Record<string, unknown>;
  evidence: { page: number; quote: string }[];
  review: { decision: "confirmed" | "disputed"; note: string | null; reviewerName: string | null; decidedAt: string } | null;
};

/** Machine codes of knowledge actions; the UI localises them (AMB-11). */
export type KnowledgeErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "VALIDATION"
  | "NOT_FOUND"
  | "INVALID_TRANSITION"
  | "NO_FACTS"
  | "INTEGRITY"
  | "SOURCE_MISSING"
  | "QUOTE_MISMATCH"
  | "ALREADY_LOADED"
  | "UNAVAILABLE";

/** Standard action result (E-5). */
export type KnowledgeActionResult =
  | { success: true; data: { message: "FACTS_LOADED" | "RULE_CONFIRMED" | "RULE_DISPUTED"; rules?: number } }
  | { success: false; code: KnowledgeErrorCode; detail?: string };
