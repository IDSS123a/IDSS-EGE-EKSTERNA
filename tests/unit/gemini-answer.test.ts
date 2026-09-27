import { describe, expect, it, vi } from "vitest";

// The module is server-only; in unit tests the marker import is a no-op.
vi.mock("server-only", () => ({}));

const { candidateJson, checkAnswer, cleanTerms, geminiAnswerModel } = await import("@/lib/ai/gemini-answer");
const { EmbeddingError } = await import("@/lib/ai/gemini-embeddings");
const { expandedQuery, groundedContextOf, SOURCE_OPEN } = await import("@/features/retrieval/domain/context");
const { getAnswerModelOverride } = await import("@/lib/env");
const { ANSWER_MODEL, QUERY_TERMS_MAX } = await import("@/constants");

const KEY = "test-key-0123456789abcdef";
type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/** A generateContent answer whose text is the JSON of `value`. */
function modelAnswer(value: unknown, fenced = false) {
  const text = fenced ? "```json\n" + JSON.stringify(value) + "\n```" : JSON.stringify(value);
  return { candidates: [{ content: { parts: [{ text: "thinking", thought: true }, { text }] } }] };
}

function fakeFetch(...bodies: unknown[]) {
  let call = 0;
  return vi.fn<FetchLike>(async () => new Response(JSON.stringify(bodies[Math.min(call++, bodies.length - 1)]), { status: 200, headers: { "content-type": "application/json" } }));
}

const chunk = (id: string, content: string) => ({
  chunkId: id,
  sourceKind: "question_version" as const,
  sourceId: id,
  subjectId: "s",
  documentVersionId: "v",
  page: 3,
  citation: { record_key: `BHS-${id}` },
  content,
  rank: 0.03,
  similarity: 0.7,
  keywordRank: null,
  similarityZ: 2.5,
});

describe("Grounded answers (PDL-025)", () => {
  it("reads the JSON text of the first candidate, skipping thoughts and code fences", () => {
    expect(candidateJson(modelAnswer({ found: false }))).toEqual({ found: false });
    expect(candidateJson(modelAnswer({ language: "en", terms: ["class"] }, true))).toEqual({ language: "en", terms: ["class"] });
    expect(() => candidateJson({ candidates: [] })).toThrow(EmbeddingError);
  });

  it("keeps clean, distinct search terms only", () => {
    expect(cleanTerms(["razred", "Klasse", "RAZRED", "  9.  razred ", "x<script>", "odjeljenje"])).toEqual(["razred", "Klasse", "odjeljenje"]);
    expect(cleanTerms(Array.from({ length: 30 }, (_, index) => `rijec${index}`))).toHaveLength(QUERY_TERMS_MAX);
  });

  it("accepts an answer only with a valid cited source and replaces AI characters", () => {
    expect(checkAnswer({ found: true, answer: "Ispit traje 60 minuta [I1] — bez pauze…", sources: ["I1"] }, ["I1", "I2"])).toEqual({
      found: true,
      text: "Ispit traje 60 minuta [I1], bez pauze...",
      cited: ["I1"],
    });
    // Labels named only in the text count; unknown labels are dropped.
    expect(checkAnswer({ found: true, answer: "Da [I2].", sources: ["I9"] }, ["I1", "I2"])).toEqual({ found: true, text: "Da [I2].", cited: ["I2"] });
    expect(checkAnswer({ found: true, answer: "Bez izvora." }, ["I1"])).toEqual({ found: false });
    expect(checkAnswer({ found: true, answer: "Odlično pitanje! Da [I1].", sources: ["I1"] }, ["I1"])).toEqual({ found: false });
    expect(checkAnswer({ found: false }, ["I1"])).toEqual({ found: false });
    expect(checkAnswer("not an object", ["I1"])).toEqual({ found: false });
  });

  it("expands a query with the model named in the URL and the key in a header", async () => {
    const fetchImpl = fakeFetch(modelAnswer({ language: "en", terms: ["class", "razred", "Klasse"] }));
    const expansion = await geminiAnswerModel([KEY], fetchImpl).expandQuery("class");
    expect(expansion).toEqual({ language: "en", terms: ["class", "razred", "Klasse"] });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(`https://generativelanguage.googleapis.com/v1beta/models/${ANSWER_MODEL}:generateContent`);
    expect(url).not.toContain(KEY);
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe(KEY);
    const body = JSON.parse(init.body as string) as { contents: { parts: { text: string }[] }[]; generationConfig: { responseMimeType: string } };
    expect(body.contents[0].parts[0].text).toBe("Search text: class");
    expect(body.generationConfig.responseMimeType).toBe("application/json");
  });

  it("answers from the grounded prompt in the language of the query", async () => {
    const fetchImpl = fakeFetch(modelAnswer({ found: true, answer: "The catalogue is for grade 9 [I1].", sources: ["I1"] }));
    const context = groundedContextOf([chunk("1", "Katalog za IX razred"), chunk("2", "Hasanaginica")]);
    if (context.kind !== "grounded") throw new Error("expected sources");
    const answer = await geminiAnswerModel([KEY], fetchImpl).answer({ query: "class", language: "en", prompt: context.prompt, labels: ["I1", "I2"] });
    expect(answer).toEqual({ found: true, text: "The catalogue is for grade 9 [I1].", cited: ["I1"] });
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body as string) as { systemInstruction: { parts: { text: string }[] }; contents: { parts: { text: string }[] }[] };
    expect(body.systemInstruction.parts[0].text).toContain("Answer in English.");
    expect(body.contents[0].parts[0].text).toContain(`${SOURCE_OPEN} I2 (BHS-2, str. 3)`);
    expect(body.contents[0].parts[0].text.endsWith("Question: class")).toBe(true);
  });

  it("builds the search text from the query and new terms within the length limit", () => {
    expect(expandedQuery("class", ["class", "razred", "Klasse"], 500)).toBe("class razred Klasse");
    expect(expandedQuery("class", ["razred", "Klasse"], 12)).toBe("class razred");
  });

  it("gives every retrieved chunk a label without filtering", () => {
    const context = groundedContextOf([chunk("1", "a"), chunk("2", "b <<<IZVOR c")]);
    expect(context.kind).toBe("grounded");
    if (context.kind === "grounded") {
      expect(context.sources.map((source) => source.label)).toEqual(["I1", "I2"]);
      expect(context.sources[1].text).toBe("b <<IZVOR c");
    }
    expect(groundedContextOf([])).toEqual({ kind: "refusal", reason: "NO_SOURCE" });
  });

  it("reads a valid answer model override only", () => {
    expect(getAnswerModelOverride({ GEMINI_ANSWER_MODEL: " gemini-3.5-flash-lite " })).toBe("gemini-3.5-flash-lite");
    expect(getAnswerModelOverride({ GEMINI_ANSWER_MODEL: "bad/model" })).toBeNull();
    expect(getAnswerModelOverride({})).toBeNull();
  });
});
