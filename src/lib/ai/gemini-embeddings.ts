import "server-only";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL, EMBEDDING_TIMEOUT_MS } from "@/constants";

/**
 * Gemini embeddings over REST (PDL-023), without an SDK dependency. Only two kinds of text are ever sent:
 * catalogue text (documents) and the words a staff member typed into the search (queries). No names,
 * accounts or results. gemini-embedding-2 ignores taskType; the task instruction is part of the text, in
 * the formats Google documents for retrieval. Vectors are returned L2-normalised (reduced dimensions are
 * not normalised by the API).
 */

const API_ROOT = "https://generativelanguage.googleapis.com/v1beta";

export type EmbeddingErrorCode = "NOT_CONFIGURED" | "REJECTED" | "RATE_LIMITED" | "UNAVAILABLE";

/** A failed Gemini call with a machine code the UI localises. */
export class EmbeddingError extends Error {
  constructor(public readonly code: EmbeddingErrorCode, message: string) {
    super(message);
    this.name = "EmbeddingError";
  }
}

export interface Embedder {
  readonly model: string;
  /** Vectors for catalogue passages, in input order. */
  embedDocuments(documents: readonly { title: string; text: string }[]): Promise<number[][]>;
  /** Vector for a search query. */
  embedQuery(query: string): Promise<number[]>;
}

/** Document text in the retrieval format of the model. */
export function documentPrompt(title: string, text: string): string {
  return `title: ${title.trim() || "none"} | text: ${text}`;
}

/** Query text in the retrieval format of the model. */
export function queryPrompt(query: string): string {
  return `task: search result | query: ${query}`;
}

/** L2-normalised copy of a vector (cosine distance then equals dot-product distance). */
export function normalise(values: readonly number[]): number[] {
  const length = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  if (!Number.isFinite(length) || length === 0) throw new EmbeddingError("UNAVAILABLE", "embedding has no length");
  return values.map((value) => value / length);
}

function codeForStatus(status: number): EmbeddingErrorCode {
  if (status === 429) return "RATE_LIMITED";
  if (status === 400 || status === 401 || status === 403 || status === 404) return "REJECTED";
  return "UNAVAILABLE";
}

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

function checkVector(values: unknown): number[] {
  if (!Array.isArray(values) || values.length !== EMBEDDING_DIMENSIONS || !values.every((value) => typeof value === "number" && Number.isFinite(value))) {
    throw new EmbeddingError("UNAVAILABLE", "unexpected embedding shape");
  }
  return normalise(values as number[]);
}

/**
 * Gemini embedder. The key travels in the x-goog-api-key header, never in the URL (it would appear in logs).
 * @throws EmbeddingError on a missing key, a refused request, rate limiting or an unexpected answer
 */
export function geminiEmbedder(apiKey: string | null, fetchImpl: FetchLike = fetch, model: string = EMBEDDING_MODEL): Embedder {
  async function call(method: "embedContent" | "batchEmbedContents", body: unknown): Promise<unknown> {
    if (!apiKey) throw new EmbeddingError("NOT_CONFIGURED", "GEMINI_API_KEY is not set");
    let response: Response;
    try {
      response = await fetchImpl(`${API_ROOT}/models/${model}:${method}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(EMBEDDING_TIMEOUT_MS),
      });
    } catch (error) {
      throw new EmbeddingError("UNAVAILABLE", `Gemini request failed: ${error instanceof Error ? error.name : "unknown"}`);
    }
    if (!response.ok) throw new EmbeddingError(codeForStatus(response.status), `Gemini answered ${response.status}`);
    return response.json();
  }

  const request = (text: string) => ({ model: `models/${model}`, content: { parts: [{ text }] }, outputDimensionality: EMBEDDING_DIMENSIONS });

  return {
    model,
    async embedDocuments(documents) {
      if (documents.length === 0) return [];
      const answer = (await call("batchEmbedContents", { requests: documents.map((document) => request(documentPrompt(document.title, document.text))) })) as { embeddings?: { values?: unknown }[] };
      if (!Array.isArray(answer.embeddings) || answer.embeddings.length !== documents.length) throw new EmbeddingError("UNAVAILABLE", "unexpected batch answer");
      return answer.embeddings.map((embedding) => checkVector(embedding.values));
    },
    async embedQuery(query) {
      const answer = (await call("embedContent", { content: { parts: [{ text: queryPrompt(query) }] }, outputDimensionality: EMBEDDING_DIMENSIONS })) as { embedding?: { values?: unknown } };
      return checkVector(answer.embedding?.values);
    },
  };
}
