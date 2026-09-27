import { describe, expect, it, vi } from "vitest";

// The module is server-only; in unit tests the marker import is a no-op.
vi.mock("server-only", () => ({}));

const { EmbeddingError, documentPrompt, geminiEmbedder, normalise, queryPrompt } = await import("@/lib/ai/gemini-embeddings");
const { isEvidence, relevant } = await import("@/features/retrieval/domain/context");
const { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } = await import("@/constants");

const KEY = "test-key-0123456789abcdef";
const vector = (value: number) => Array.from({ length: EMBEDDING_DIMENSIONS }, () => value);

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

function fakeFetch(status: number, body: unknown) {
  return vi.fn<FetchLike>(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
}

describe("Gemini embeddings (PDL-023)", () => {
  it("uses the documented retrieval prompts", () => {
    expect(documentPrompt("Ispitni katalog", "Koliko traje ispit?")).toBe("title: Ispitni katalog | text: Koliko traje ispit?");
    expect(documentPrompt(" ", "x")).toBe("title: none | text: x");
    expect(queryPrompt("koliko traje ispit")).toBe("task: search result | query: koliko traje ispit");
  });

  it("sends documents in one batch with the key in a header, never in the URL", async () => {
    const fetchImpl = fakeFetch(200, { embeddings: [{ values: vector(2) }, { values: vector(3) }] });
    const vectors = await geminiEmbedder([KEY], fetchImpl).embedDocuments([{ title: "T", text: "a" }, { title: "T", text: "b" }]);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(`https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents`);
    expect(url).not.toContain(KEY);
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe(KEY);
    const body = JSON.parse(init.body as string) as { requests: { model: string; content: { parts: { text: string }[] }; outputDimensionality: number }[] };
    expect(body.requests).toHaveLength(2);
    expect(body.requests[0]).toEqual({ model: `models/${EMBEDDING_MODEL}`, content: { parts: [{ text: "title: T | text: a" }] }, outputDimensionality: EMBEDDING_DIMENSIONS });
    // Returned vectors are unit length.
    expect(Math.hypot(...vectors[0])).toBeCloseTo(1, 6);
    expect(vectors[1][0]).toBeCloseTo(1 / Math.sqrt(EMBEDDING_DIMENSIONS), 9);
  });

  it("embeds a query with embedContent", async () => {
    const fetchImpl = fakeFetch(200, { embedding: { values: vector(1) } });
    const result = await geminiEmbedder([KEY], fetchImpl).embedQuery("Perfekt");
    expect(fetchImpl.mock.calls[0][0]).toContain(":embedContent");
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body as string)).toEqual({ content: { parts: [{ text: "task: search result | query: Perfekt" }] }, outputDimensionality: EMBEDDING_DIMENSIONS });
    expect(result).toHaveLength(EMBEDDING_DIMENSIONS);
  });

  it("maps failures to machine codes", async () => {
    const codeOf = async (promise: Promise<unknown>) => promise.then(() => "none", (error: unknown) => (error instanceof EmbeddingError ? error.code : "other"));
    expect(await codeOf(geminiEmbedder([], fakeFetch(200, {})).embedQuery("x"))).toBe("NOT_CONFIGURED");
    expect(await codeOf(geminiEmbedder([KEY], fakeFetch(429, {})).embedQuery("x"))).toBe("RATE_LIMITED");
    expect(await codeOf(geminiEmbedder([KEY], fakeFetch(403, {})).embedQuery("x"))).toBe("REJECTED");
    expect(await codeOf(geminiEmbedder([KEY], fakeFetch(503, {})).embedQuery("x"))).toBe("UNAVAILABLE");
    expect(await codeOf(geminiEmbedder([KEY], fakeFetch(200, { embedding: { values: [1, 2] } })).embedQuery("x"))).toBe("UNAVAILABLE");
    expect(await codeOf(geminiEmbedder([KEY], fakeFetch(200, { embeddings: [] })).embedDocuments([{ title: "T", text: "a" }]))).toBe("UNAVAILABLE");
    const failing = vi.fn(async () => {
      throw new TypeError("network");
    });
    expect(await codeOf(geminiEmbedder([KEY], failing).embedQuery("x"))).toBe("UNAVAILABLE");
  });

  it("does not call the API for an empty batch and refuses a zero vector", async () => {
    const fetchImpl = fakeFetch(200, {});
    expect(await geminiEmbedder([KEY], fetchImpl).embedDocuments([])).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(() => normalise([0, 0])).toThrow(EmbeddingError);
  });
});

describe("key rotation (Director: GEMINI_API_KEY_1 to _10)", () => {
  it("reads the keys in number order, ignores empty values and duplicates", async () => {
    const { getGeminiApiKeys } = await import("@/lib/env");
    const k = (n: number) => `key-${n}-0123456789abcdefghij`;
    expect(getGeminiApiKeys({ GEMINI_API_KEY_10: k(10), GEMINI_API_KEY_2: k(2), GEMINI_API_KEY_1: k(1), GEMINI_API_KEY_3: "", GOOGLE_API_KEY: k(1), OTHER: k(9) })).toEqual([k(1), k(2), k(10)]);
    expect(getGeminiApiKeys({ GEMINI_API_KEY: k(0), GEMINI_API_KEY_1: k(1) })).toEqual([k(0), k(1)]);
    expect(getGeminiApiKeys({})).toEqual([]);
  });

  it("recovers from a passing server error on the next attempt", async () => {
    const statuses = [500, 200];
    const fetchImpl = vi.fn<FetchLike>(async () => {
      const status = statuses.shift() ?? 200;
      return new Response(JSON.stringify(status === 200 ? { embedding: { values: vector(1) } } : {}), { status });
    });
    await expect(geminiEmbedder(["a-key-000000000000000000"], fetchImpl).embedQuery("x")).resolves.toHaveLength(EMBEDDING_DIMENSIONS);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("hands the request to the next key when one is over quota or refused", async () => {
    const statuses = [429, 403, 200];
    const fetchImpl = vi.fn<FetchLike>(async () => {
      const status = statuses.shift() ?? 200;
      return new Response(JSON.stringify(status === 200 ? { embedding: { values: vector(1) } } : {}), { status });
    });
    await geminiEmbedder(["a-key-000000000000000000", "b-key-000000000000000000", "c-key-000000000000000000"], fetchImpl).embedQuery("x");
    const used = fetchImpl.mock.calls.map((call) => (call[1].headers as Record<string, string>)["x-goog-api-key"]);
    expect(new Set(used).size).toBe(3);
  });

  it("reports RATE_LIMITED when every key is over quota, and retries server errors a bounded number of times", async () => {
    const over = fakeFetch(429, {});
    const error = await geminiEmbedder(["a-key-000000000000000000", "b-key-000000000000000000"], over).embedQuery("x").catch((caught: unknown) => caught);
    expect(error instanceof EmbeddingError && error.code).toBe("RATE_LIMITED");
    expect(over).toHaveBeenCalledTimes(2);
    const down = fakeFetch(503, {});
    const failure = await geminiEmbedder(["a-key-000000000000000000", "b-key-000000000000000000"], down).embedQuery("x").catch((caught: unknown) => caught);
    expect(down).toHaveBeenCalledTimes(3);
    expect(failure instanceof EmbeddingError && failure.code).toBe("UNAVAILABLE");
    expect(failure instanceof EmbeddingError && failure.detail).toBe("Gemini: 503");
    const missing = fakeFetch(404, {});
    await geminiEmbedder(["a-key-000000000000000000", "b-key-000000000000000000"], missing).embedQuery("x").catch(() => undefined);
    expect(missing).toHaveBeenCalledTimes(1);
  });

  it("spreads successive requests over the keys", async () => {
    const fetchImpl = fakeFetch(200, { embedding: { values: vector(1) } });
    const embedder = geminiEmbedder(["a-key-000000000000000000", "b-key-000000000000000000"], fetchImpl);
    await embedder.embedQuery("x");
    await embedder.embedQuery("y");
    const used = fetchImpl.mock.calls.map((call) => (call[1].headers as Record<string, string>)["x-goog-api-key"]);
    expect(new Set(used).size).toBe(2);
  });
});

describe("evidence rule with semantic results", () => {
  const chunk = (fields: { rank: number; similarity?: number | null; keywordRank?: number | null }) => ({
    chunkId: "c", sourceKind: "question_version" as const, sourceId: "s", subjectId: "x", documentVersionId: "v", page: 1, citation: {}, content: "t", ...fields,
  });

  it("keeps full-text behaviour for full-text results", () => {
    expect(isEvidence(chunk({ rank: 1.2 }), 1)).toBe(true);
    expect(isEvidence(chunk({ rank: 0.4 }), 1)).toBe(false);
  });

  it("accepts a semantic result by a matched word or by close meaning, and refuses otherwise", () => {
    expect(isEvidence(chunk({ rank: 0.03, similarity: 0.4, keywordRank: 1.5 }), 1, 0.6)).toBe(true);
    expect(isEvidence(chunk({ rank: 0.02, similarity: 0.72, keywordRank: null }), 1, 0.6)).toBe(true);
    expect(isEvidence(chunk({ rank: 0.02, similarity: 0.41, keywordRank: null }), 1, 0.6)).toBe(false);
    expect(relevant([chunk({ rank: 0.02, similarity: 0.41, keywordRank: null })], 1, 0.6)).toEqual([]);
  });
});

describe("semantic index build: one bad passage never blocks the others", () => {
  const passage = (id: string) => ({ chunkId: id, title: "T", content: `text ${id}`, contentSha256: "0".repeat(64) });

  it("splits a failing batch, sets the failing passage aside and stores the rest", async () => {
    const { embedAndStore } = await import("@/features/retrieval/domain/build");
    const embedder = {
      model: EMBEDDING_MODEL,
      embedQuery: async () => vector(1),
      embedDocuments: async (documents: readonly { title: string; text: string }[]) => {
        if (documents.some((document) => document.text === "text c")) throw new EmbeddingError("UNAVAILABLE", "server error", "Gemini: 500");
        return documents.map(() => vector(1));
      },
    };
    const state = { stored: 0, skipped: new Map<string, string>(), anyEmbedded: false };
    const stored: string[] = [];
    await embedAndStore(embedder, ["a", "b", "c", "d", "e"].map(passage), state, async (rows) => {
      stored.push(...rows.map((row) => row.chunkId));
      return rows.length;
    });
    expect(stored.sort()).toEqual(["a", "b", "d", "e"]);
    expect(state.stored).toBe(4);
    expect([...state.skipped.entries()]).toEqual([["c", "Gemini: 500"]]);
  });

  it("stops the build on quota and on a refusal before anything worked", async () => {
    const { embedAndStore } = await import("@/features/retrieval/domain/build");
    const failing = (code: "RATE_LIMITED" | "REJECTED") => ({
      model: EMBEDDING_MODEL,
      embedQuery: async () => vector(1),
      embedDocuments: async (): Promise<number[][]> => {
        throw new EmbeddingError(code, "refused", "Gemini: 400");
      },
    });
    const state = () => ({ stored: 0, skipped: new Map<string, string>(), anyEmbedded: false });
    await expect(embedAndStore(failing("RATE_LIMITED"), [passage("a"), passage("b")], state(), async () => 0)).rejects.toThrow(EmbeddingError);
    await expect(embedAndStore(failing("REJECTED"), [passage("a"), passage("b")], state(), async () => 0)).rejects.toThrow(EmbeddingError);
  });
});
