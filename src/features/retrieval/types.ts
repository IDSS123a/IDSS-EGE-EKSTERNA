/** One retrieved piece of trusted canon with what an answer must cite. */
export type RetrievedChunk = {
  chunkId: string;
  sourceKind: "question_version" | "canonical_rule";
  sourceId: string;
  subjectId: string;
  documentVersionId: string;
  page: number | null;
  citation: { record_key?: string; rule_code?: string; page?: number; pages?: number[]; area?: string | null; official_title?: string };
  content: string;
  /** Matched content words plus the full-text rank (see migration 011). */
  rank: number;
};

/** A retrieval request: the provider decides how to rank, never what the caller may see (the database does). */
export type RetrievalRequest = { actorUserId: string; query: string; subjectId: string | null; k: number };

/**
 * Retrieval provider interface (A-5). The full-text implementation is the only one today; a Gemini
 * embedding implementation plugs in here later (PDL-017) without changing callers.
 */
export interface CanonRetriever {
  readonly name: string;
  retrieve(request: RetrievalRequest): Promise<RetrievedChunk[]>;
}

/** Grounded context for a later generation step, or a refusal when the canon has nothing relevant. */
export type GroundedContext =
  | { kind: "grounded"; sources: { label: string; citation: string; text: string }[]; prompt: string }
  | { kind: "refusal"; reason: "NO_SOURCE" };

/** Machine codes of retrieval actions; the UI localises them (AMB-11). */
export type RetrievalErrorCode = "UNAUTHENTICATED" | "FORBIDDEN" | "VALIDATION" | "UNAVAILABLE";

export type SearchResult =
  | { success: true; data: { results: RetrievedChunk[]; refused: boolean } }
  | { success: false; code: RetrievalErrorCode };

export type IndexResult =
  | { success: true; data: { questionChunksAdded: number; ruleChunksAdded: number; total: number } }
  | { success: false; code: RetrievalErrorCode };
