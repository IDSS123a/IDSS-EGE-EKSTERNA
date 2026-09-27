import { describe, expect, it, vi } from "vitest";

// The module is server-only; in unit tests the marker import is a no-op.
vi.mock("server-only", () => ({}));

const { EmbeddingError, documentPrompt, geminiEmbedder, normalise, queryPrompt } = await import("@/lib/ai/gemini-embeddings");
const { isEvidence, relevant } = await import("@/features/retrieval/domain/context");
const { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } = await import("@/constants");

const KEY = "test-key-0123456789abcdef";
const vector = (value: number) => Array.from({ length: EMBEDDING_DIMENSIONS }, () => value);

function fakeFetch(status: number, body: unknown) {
  return vi.fn(async (_url: string, _init: RequestInit) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
}

describe("Gemini embeddings (PDL-023)", () => {
  it("uses the documented retrieval prompts", () => {
    expect(documentPrompt("Ispitni katalog", "Koliko traje ispit?")).toBe("title: Ispitni katalog | text: Koliko traje ispit?");
    expect(documentPrompt(" ", "x")).toBe("title: none | text: x");
    expect(queryPrompt("koliko traje ispit")).toBe("task: search result | query: koliko traje ispit");
  });

  it("sends documents in one batch with the key in a header, never in the URL", async () => {
    const fetchImpl = fakeFetch(200, { embeddings: [{ values: vector(2) }, { values: vector(3) }] });
    const vectors = await geminiEmbedder(KEY, fetchImpl).embedDocuments([{ title: "T", text: "a" }, { title: "T", text: "b" }]);
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
    const result = await geminiEmbedder(KEY, fetchImpl).embedQuery("Perfekt");
    expect(fetchImpl.mock.calls[0][0]).toContain(":embedContent");
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body as string)).toEqual({ content: { parts: [{ text: "task: search result | query: Perfekt" }] }, outputDimensionality: EMBEDDING_DIMENSIONS });
    expect(result).toHaveLength(EMBEDDING_DIMENSIONS);
  });

  it("maps failures to machine codes", async () => {
    const codeOf = async (promise: Promise<unknown>) => promise.then(() => "none", (error: unknown) => (error instanceof EmbeddingError ? error.code : "other"));
    expect(await codeOf(geminiEmbedder(null, fakeFetch(200, {})).embedQuery("x"))).toBe("NOT_CONFIGURED");
    expect(await codeOf(geminiEmbedder(KEY, fakeFetch(429, {})).embedQuery("x"))).toBe("RATE_LIMITED");
    expect(await codeOf(geminiEmbedder(KEY, fakeFetch(403, {})).embedQuery("x"))).toBe("REJECTED");
    expect(await codeOf(geminiEmbedder(KEY, fakeFetch(503, {})).embedQuery("x"))).toBe("UNAVAILABLE");
    expect(await codeOf(geminiEmbedder(KEY, fakeFetch(200, { embedding: { values: [1, 2] } })).embedQuery("x"))).toBe("UNAVAILABLE");
    expect(await codeOf(geminiEmbedder(KEY, fakeFetch(200, { embeddings: [] })).embedDocuments([{ title: "T", text: "a" }]))).toBe("UNAVAILABLE");
    const failing = vi.fn(async () => {
      throw new TypeError("network");
    });
    expect(await codeOf(geminiEmbedder(KEY, failing).embedQuery("x"))).toBe("UNAVAILABLE");
  });

  it("does not call the API for an empty batch and refuses a zero vector", async () => {
    const fetchImpl = fakeFetch(200, {});
    expect(await geminiEmbedder(KEY, fetchImpl).embedDocuments([])).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(() => normalise([0, 0])).toThrow(EmbeddingError);
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
