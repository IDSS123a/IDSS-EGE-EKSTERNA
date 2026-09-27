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
  /** Full-text: matched content words plus the full-text rank (migration 011). Semantic: the fused rank (migration 015). */
  rank: number;
  /** Semantic search only: cosine similarity of query and passage (null when only the words matched). */
  similarity?: number | null;
  /** Semantic search only: the full-text rank that was fused in (null when no content word matched). */
  keywordRank?: number | null;
  /** Semantic search only: standard deviations above the query's mean similarity over all passages in scope (migration 016). */
  similarityZ?: number | null;
};

/** A retrieval request: the provider decides how to rank, never what the caller may see (the database does). */
export type RetrievalRequest = { actorUserId: string; query: string; subjectId: string | null; k: number };

/**
 * Retrieval provider interface (A-5): full-text ranking (migration 011) and semantic ranking with Gemini
 * embeddings fused with full-text (migration 015, PDL-023). Callers do not depend on which one answers.
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
export type RetrievalErrorCode = "UNAUTHENTICATED" | "FORBIDDEN" | "VALIDATION" | "UNAVAILABLE" | "NOT_CONFIGURED" | "REJECTED" | "RATE_LIMITED";

/** Which ranking answered a search. */
export type RetrievalMethod = "semantic" | "full_text";

export type SearchResult =
  | { success: true; data: { results: RetrievedChunk[]; refused: boolean; method: RetrievalMethod; fallback: RetrievalErrorCode | null } }
  | { success: false; code: RetrievalErrorCode };

export type IndexResult =
  | { success: true; data: { questionChunksAdded: number; ruleChunksAdded: number; total: number } }
  | { success: false; code: RetrievalErrorCode };

export type SemanticIndexResult =
  | { success: true; data: { stored: number; embedded: number; complete: boolean; skipped: number; detail: string | null } }
  | { success: false; code: RetrievalErrorCode; detail?: string };
