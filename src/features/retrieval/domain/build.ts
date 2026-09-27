import { EmbeddingError, type Embedder } from "@/lib/ai/gemini-embeddings";

/**
 * Semantic index build steps (PDL-023), framework-free apart from the embedder interface: a batch Gemini cannot
 * answer is split until the failing passage is found, which is set aside with Gemini's answer as detail, so one
 * bad passage never blocks the others. Quota, missing keys, a wrong model, or a refusal before anything worked
 * stop the build.
 */

/** A passage to embed: exactly the text and its hash. */
export type PassageToEmbed = { chunkId: string; title: string; content: string; contentSha256: string };

/** Progress of one index build click. */
export type BuildState = { stored: number; skipped: Map<string, string>; anyEmbedded: boolean };

/** Embed and store one batch; on a passage-level failure split the batch and set the failing passage aside. */
export async function embedAndStore(embedder: Embedder, batch: PassageToEmbed[], state: BuildState, store: (rows: { chunkId: string; contentSha256: string; embedding: number[] }[]) => Promise<number>): Promise<void> {
  let vectors: number[][];
  try {
    vectors = await embedder.embedDocuments(batch.map((chunk) => ({ title: chunk.title, text: chunk.content })));
  } catch (error) {
    // Quota, missing keys, a wrong model, or refusal before anything worked: stop the whole build.
    const passageLevel = error instanceof EmbeddingError && (error.code === "UNAVAILABLE" || (error.code === "REJECTED" && state.anyEmbedded && error.detail !== "Gemini: 404"));
    if (!passageLevel) throw error;
    if (batch.length === 1) {
      state.skipped.set(batch[0].chunkId, error.detail);
      return;
    }
    const middle = Math.ceil(batch.length / 2);
    await embedAndStore(embedder, batch.slice(0, middle), state, store);
    await embedAndStore(embedder, batch.slice(middle), state, store);
    return;
  }
  state.anyEmbedded = true;
  state.stored += await store(batch.map((chunk, index) => ({ chunkId: chunk.chunkId, contentSha256: chunk.contentSha256, embedding: vectors[index] })));
}

