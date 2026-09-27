import "server-only";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL, EMBEDDING_TIMEOUT_MS } from "@/constants";

/**
 * Gemini embeddings over REST (PDL-023), without an SDK dependency. Only two kinds of text are ever sent:
 * catalogue text (documents) and the words a staff member typed into the search (queries). No names,
 * accounts or results. gemini-embedding-2 ignores taskType; the task instruction is part of the text, in
 * the formats Google documents for retrieval. Vectors are returned L2-normalised (reduced dimensions are
 * not normalised by the API).
 *
 * Several keys rotate (Director, 27.09.2026, quota): requests start at the next key in turn, and a key that answers
 * 429 (quota) or 400/401/403 (refused) hands the request to the following key. A server error (5xx) or a network
 * failure is retried on the next key after a short pause, at most RETRY_ATTEMPTS times. 404 is never retried.
 */

const API_ROOT = "https://generativelanguage.googleapis.com/v1beta";

export type EmbeddingErrorCode = "NOT_CONFIGURED" | "REJECTED" | "RATE_LIMITED" | "UNAVAILABLE";

/** A failed Gemini call with a machine code the UI localises. */
export class EmbeddingError extends Error {
  /**
   * @param code machine code for the UI
   * @param detail short, key-free description for the Director ("Gemini: 503"); never contains a key
   */
  constructor(public readonly code: EmbeddingErrorCode, message: string, public readonly detail: string = message) {
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

/** Attempts for server errors and network failures (quota and refusals rotate through all keys instead). */
const RETRY_ATTEMPTS = 3;
const RETRY_PAUSE_MS = 400;

function checkVector(values: unknown): number[] {
  if (!Array.isArray(values) || values.length !== EMBEDDING_DIMENSIONS || !values.every((value) => typeof value === "number" && Number.isFinite(value))) {
    const size = Array.isArray(values) ? values.length : 0;
    throw new EmbeddingError("UNAVAILABLE", "unexpected embedding shape", `Gemini: ${size} values instead of ${EMBEDDING_DIMENSIONS}`);
  }
  return normalise(values as number[]);
}

function pause(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/** Round-robin start position shared by all embedders of this server process. */
let nextKey = 0;

/**
 * Gemini embedder over one or more keys. Keys travel in the x-goog-api-key header, never in the URL (it would
 * appear in logs).
 * @throws EmbeddingError: NOT_CONFIGURED without keys; RATE_LIMITED when every key is over quota; REJECTED when
 *   every key was refused; UNAVAILABLE on other failures or an unexpected answer
 */
export function geminiEmbedder(apiKeys: readonly string[], fetchImpl: FetchLike = fetch, model: string = EMBEDDING_MODEL): Embedder {
  async function send(apiKey: string, method: string, body: unknown): Promise<Response> {
    try {
      return await fetchImpl(`${API_ROOT}/models/${model}:${method}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(EMBEDDING_TIMEOUT_MS),
      });
    } catch (error) {
      const name = error instanceof Error ? error.name : "unknown";
      throw new EmbeddingError("UNAVAILABLE", `Gemini request failed: ${name}`, name === "TimeoutError" ? "Gemini: timeout" : "Gemini: network");
    }
  }

  async function call(method: "embedContent" | "batchEmbedContents", body: unknown): Promise<unknown> {
    if (apiKeys.length === 0) throw new EmbeddingError("NOT_CONFIGURED", "no Gemini API key is set");
    const start = nextKey % apiKeys.length;
    nextKey = (start + 1) % apiKeys.length;
    let rateLimited = false;
    let lastStatus = 0;
    let failures = 0;
    let refusals = 0;
    for (let attempt = 0; refusals < apiKeys.length; attempt += 1) {
      const apiKey = apiKeys[(start + attempt) % apiKeys.length];
      let response: Response;
      try {
        response = await send(apiKey, method, body);
      } catch (error) {
        failures += 1;
        if (failures >= RETRY_ATTEMPTS) throw error;
        await pause(RETRY_PAUSE_MS * failures);
        continue;
      }
      if (response.ok) return response.json();
      lastStatus = response.status;
      // 404 means the model or method is wrong, which no other key fixes.
      if (response.status === 404) throw new EmbeddingError("REJECTED", "Gemini answered 404", "Gemini: 404");
      const code = codeForStatus(response.status);
      if (code === "UNAVAILABLE") {
        failures += 1;
        if (failures >= RETRY_ATTEMPTS) throw new EmbeddingError(code, `Gemini answered ${response.status}`, `Gemini: ${response.status}`);
        await pause(RETRY_PAUSE_MS * failures);
        continue;
      }
      if (code === "RATE_LIMITED") rateLimited = true;
      refusals += 1;
    }
    throw new EmbeddingError(rateLimited ? "RATE_LIMITED" : "REJECTED", `every Gemini key was refused (${apiKeys.length})`, `Gemini: ${lastStatus}`);
  }

  const request = (text: string) => ({ model: `models/${model}`, content: { parts: [{ text }] }, outputDimensionality: EMBEDDING_DIMENSIONS });

  return {
    model,
    async embedDocuments(documents) {
      if (documents.length === 0) return [];
      const answer = (await call("batchEmbedContents", { requests: documents.map((document) => request(documentPrompt(document.title, document.text))) })) as { embeddings?: { values?: unknown }[] };
      if (!Array.isArray(answer.embeddings) || answer.embeddings.length !== documents.length) {
        const size = Array.isArray(answer.embeddings) ? answer.embeddings.length : 0;
        throw new EmbeddingError("UNAVAILABLE", "unexpected batch answer", `Gemini: ${size} vectors for ${documents.length} passages`);
      }
      return answer.embeddings.map((embedding) => checkVector(embedding.values));
    },
    async embedQuery(query) {
      const answer = (await call("embedContent", { content: { parts: [{ text: queryPrompt(query) }] }, outputDimensionality: EMBEDDING_DIMENSIONS })) as { embedding?: { values?: unknown } };
      return checkVector(answer.embedding?.values);
    },
  };
}
