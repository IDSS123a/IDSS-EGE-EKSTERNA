"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { ANSWER_CANDIDATE_COUNT, ANSWER_MODEL, EMBEDDING_BATCH_SIZE, EMBEDDING_BUILD_BUDGET_MS, EMBEDDING_MODEL, EMBEDDING_PENDING_WINDOW, RETRIEVAL_MIN_RANK, RETRIEVAL_MIN_SIMILARITY_Z, RETRIEVAL_QUERY_MAX_LENGTH, RETRIEVAL_RESULT_COUNT, SEARCH_PATH } from "@/constants";
import { auditIfFailed, formId } from "@/features/audit/failures";
import { clientIpFrom } from "@/features/authentication/domain";
import { getCurrentAccount } from "@/features/authentication/session";
import { RegistryFunctionError } from "@/features/canon/repository";
import { geminiAnswerModel, type QueryExpansion } from "@/lib/ai/gemini-answer";
import { EmbeddingError, geminiEmbedder } from "@/lib/ai/gemini-embeddings";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { getAnswerModelOverride, getGeminiApiKeys } from "@/lib/env";
import { logError, logInfo } from "@/lib/logger";
import { canBuildIndex, canReviewSubject, canSearchCanon } from "@/lib/permissions";
import { CanonSearchSchema } from "@/lib/validation/schemas";
import { embedAndStore, type BuildState } from "./domain/build";
import { expandedQuery, groundedContextOf, relevant } from "./domain/context";
import { embeddingCount, fullTextRetriever, pendingEmbeddings, rebuildIndex, semanticRetriever, storeEmbeddings } from "./repository";
import type { IndexResult, RetrievalErrorCode, RetrievalMethod, RetrievedChunk, SearchAnswer, SearchResult, SemanticIndexResult } from "./types";

function databaseCode(error: unknown): RetrievalErrorCode {
  if (error instanceof EmbeddingError) return error.code;
  if (error instanceof RegistryFunctionError && (error.databaseMessage === "FORBIDDEN" || error.databaseMessage === "VALIDATION")) return error.databaseMessage;
  return "UNAVAILABLE";
}

/**
 * POST (Server Action) searchCanonAction
 * Role required: canon.review (own subjects) or canon.publish (all).
 * Body: FormData { query (2 to 500 characters), subjectId? }.
 * With a Gemini key and the semantic index (PDL-023, PDL-025): the answer model turns the query into search terms in
 * Bosnian, German and English; retrieval ranks by meaning fused with words over the query and its terms; the answer
 * model answers only from the retrieved passages and names the ones it used, which are the results. No usable
 * passage means refused. If the answer model fails, results follow the evidence rule (word match or outstanding
 * similarity) and the screen says so. Without a key or index: search by words. The database scopes, filters active
 * versions and audits the retrieval (search text stored as a hash only). Only query and catalogue text go to Google.
 * Errors: UNAUTHENTICATED, FORBIDDEN, VALIDATION, UNAVAILABLE.
 */
export async function searchCanonAction(_previous: SearchResult | null, formData: FormData): Promise<SearchResult> {
  const result = await search(formData);
  return auditIfFailed(result, { action: "retrieval.search", entityType: "canonical_chunks", entityId: formId(formData, "subjectId") });
}

async function search(formData: FormData): Promise<SearchResult> {
  const actor = await getCurrentAccount();
  if (!actor) return { success: false, code: "UNAUTHENTICATED" };
  if (!canSearchCanon(actor)) return { success: false, code: "FORBIDDEN" };
  const parsed = CanonSearchSchema.safeParse({ query: formData.get("query"), subjectId: formData.get("subjectId") ?? undefined });
  if (!parsed.success) return { success: false, code: "VALIDATION" };
  const subjectId = parsed.data.subjectId ?? null;
  if (subjectId && !canReviewSubject(actor, subjectId)) return { success: false, code: "FORBIDDEN" };
  try {
    const admin = createSupabaseAdminClient();
    const query = parsed.data.query;
    const request = { actorUserId: actor.userId, query, subjectId, k: RETRIEVAL_RESULT_COUNT };
    const apiKeys = getGeminiApiKeys();
    if (apiKeys.length > 0 && (await embeddingCount(admin, EMBEDDING_MODEL)) > 0) {
      const answerModel = geminiAnswerModel(apiKeys, fetch, getAnswerModelOverride() ?? ANSWER_MODEL);
      let expansion: QueryExpansion | null = null;
      let answerFailure: EmbeddingError | null = null;
      try {
        expansion = await answerModel.expandQuery(query);
      } catch (error) {
        if (!(error instanceof EmbeddingError)) throw error;
        answerFailure = error;
        logError("retrieval/actions.searchCanonAction", error);
      }
      const terms = expansion?.terms ?? [];
      let retrieved: RetrievedChunk[];
      try {
        retrieved = await semanticRetriever(admin, geminiEmbedder(apiKeys)).retrieve({ ...request, query: expandedQuery(query, terms, RETRIEVAL_QUERY_MAX_LENGTH), k: ANSWER_CANDIDATE_COUNT });
      } catch (error) {
        if (!(error instanceof EmbeddingError)) throw error;
        logError("retrieval/actions.searchCanonAction", error);
        const results = relevant(await fullTextRetriever(admin).retrieve(request), RETRIEVAL_MIN_RANK);
        return { success: true, data: { results, refused: results.length === 0, method: "full_text", fallback: error.code, answer: { status: "off" }, terms } };
      }
      if (expansion && retrieved.length > 0) {
        const context = groundedContextOf(retrieved);
        if (context.kind === "grounded") {
          try {
            const labels = context.sources.map((source) => source.label);
            const answered = await answerModel.answer({ query, language: expansion.language, prompt: context.prompt, labels });
            if (!answered.found) return { success: true, data: { results: [], refused: true, method: "semantic", fallback: null, answer: { status: "not_found" }, terms } };
            const results = retrieved.map((chunk, index) => ({ ...chunk, label: labels[index] })).filter((chunk) => answered.cited.includes(chunk.label));
            return { success: true, data: { results, refused: false, method: "semantic", fallback: null, answer: { status: "answered", text: answered.text }, terms } };
          } catch (error) {
            if (!(error instanceof EmbeddingError)) throw error;
            answerFailure = error;
            logError("retrieval/actions.searchCanonAction", error);
          }
        }
      }
      const results = relevant(retrieved, RETRIEVAL_MIN_RANK, RETRIEVAL_MIN_SIMILARITY_Z).slice(0, RETRIEVAL_RESULT_COUNT);
      const answer: SearchAnswer = answerFailure ? { status: "unavailable", code: answerFailure.code, detail: answerFailure.detail } : { status: "not_found" };
      return { success: true, data: { results, refused: results.length === 0, method: "semantic", fallback: null, answer, terms } };
    }
    const method: RetrievalMethod = "full_text";
    const results = relevant(await fullTextRetriever(admin).retrieve(request), RETRIEVAL_MIN_RANK);
    return { success: true, data: { results, refused: results.length === 0, method, fallback: null, answer: { status: "off" }, terms: [] } };
  } catch (error) {
    const code = databaseCode(error);
    if (code === "UNAVAILABLE") logError("retrieval/actions.searchCanonAction", error);
    return { success: false, code };
  }
}

/**
 * POST (Server Action) buildIndexAction
 * Role required: canon.publish.
 * Adds chunks for trusted questions and confirmed rules of active versions (existing chunks stay). Audited.
 * Errors: UNAUTHENTICATED, FORBIDDEN, UNAVAILABLE.
 */
export async function buildIndexAction(): Promise<IndexResult> {
  const result = await buildIndex();
  return auditIfFailed(result, { action: "retrieval.index_build", entityType: "canonical_chunks" });
}

async function buildIndex(): Promise<IndexResult> {
  const actor = await getCurrentAccount();
  if (!actor) return { success: false, code: "UNAUTHENTICATED" };
  if (!canBuildIndex(actor)) return { success: false, code: "FORBIDDEN" };
  try {
    const counts = await rebuildIndex(createSupabaseAdminClient(), actor.userId, clientIpFrom((await headers()).get("x-forwarded-for")));
    logInfo("retrieval/actions.buildIndexAction", "retrieval index built", { added: counts.questionChunksAdded + counts.ruleChunksAdded, total: counts.total });
    revalidatePath(SEARCH_PATH);
    return { success: true, data: counts };
  } catch (error) {
    const code = databaseCode(error);
    if (code === "UNAVAILABLE") logError("retrieval/actions.buildIndexAction", error);
    return { success: false, code };
  }
}

/**
 * POST (Server Action) buildSemanticIndexAction
 * Role required: canon.publish.
 * Embeds chunks that have no vector for the current model (catalogue text only, sent to Gemini) and stores
 * each vector bound to the hash of its text; audited. Works within a time budget; "complete" false means the
 * next click continues. A batch that Gemini cannot answer is split until the failing passage is found; that
 * passage is set aside for this click (skipped, with Gemini's answer as detail) and the others are stored.
 * Quota on every key, missing keys and a wrong model stop the build. Runs where the server can reach Google.
 * Errors: UNAUTHENTICATED, FORBIDDEN, NOT_CONFIGURED, REJECTED, RATE_LIMITED, VALIDATION, UNAVAILABLE.
 */
export async function buildSemanticIndexAction(): Promise<SemanticIndexResult> {
  const result = await buildSemanticIndex();
  return auditIfFailed(result, { action: "retrieval.embeddings_build", entityType: "canonical_chunks" });
}

async function buildSemanticIndex(): Promise<SemanticIndexResult> {
  const actor = await getCurrentAccount();
  if (!actor) return { success: false, code: "UNAUTHENTICATED" };
  if (!canBuildIndex(actor)) return { success: false, code: "FORBIDDEN" };
  const apiKeys = getGeminiApiKeys();
  if (apiKeys.length === 0) return { success: false, code: "NOT_CONFIGURED" };
  const admin = createSupabaseAdminClient();
  const embedder = geminiEmbedder(apiKeys);
  const ipAddress = clientIpFrom((await headers()).get("x-forwarded-for"));
  const store = (rows: { chunkId: string; contentSha256: string; embedding: number[] }[]) => storeEmbeddings(admin, { actorUserId: actor.userId, model: embedder.model, rows, ipAddress });
  const state: BuildState = { stored: 0, skipped: new Map(), anyEmbedded: false };
  const started = Date.now();
  let exhausted = false;
  try {
    while (!exhausted && Date.now() - started < EMBEDDING_BUILD_BUDGET_MS) {
      const pending = (await pendingEmbeddings(admin, actor.userId, embedder.model, EMBEDDING_PENDING_WINDOW)).filter((chunk) => !state.skipped.has(chunk.chunkId));
      if (pending.length === 0) {
        exhausted = true;
        break;
      }
      for (let index = 0; index < pending.length && Date.now() - started < EMBEDDING_BUILD_BUDGET_MS; index += EMBEDDING_BATCH_SIZE) {
        await embedAndStore(embedder, pending.slice(index, index + EMBEDDING_BATCH_SIZE), state, store);
      }
    }
    const embedded = await embeddingCount(admin, embedder.model);
    const detail = state.skipped.size > 0 ? [...new Set(state.skipped.values())].join(", ") : null;
    logInfo("retrieval/actions.buildSemanticIndexAction", "semantic index built", { stored: state.stored, embedded, skipped: state.skipped.size, detail });
    revalidatePath(SEARCH_PATH);
    return { success: true, data: { stored: state.stored, embedded, complete: exhausted && state.skipped.size === 0, skipped: state.skipped.size, detail } };
  } catch (error) {
    const code = databaseCode(error);
    logError("retrieval/actions.buildSemanticIndexAction", error);
    if (state.stored > 0) revalidatePath(SEARCH_PATH);
    return { success: false, code, ...(error instanceof EmbeddingError ? { detail: error.detail } : {}) };
  }
}
