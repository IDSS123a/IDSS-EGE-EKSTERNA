"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { EMBEDDING_BATCH_SIZE, EMBEDDING_BUILD_BUDGET_MS, EMBEDDING_MODEL, RETRIEVAL_MIN_RANK, RETRIEVAL_MIN_SIMILARITY, RETRIEVAL_RESULT_COUNT, SEARCH_PATH } from "@/constants";
import { auditIfFailed, formId } from "@/features/audit/failures";
import { clientIpFrom } from "@/features/authentication/domain";
import { getCurrentAccount } from "@/features/authentication/session";
import { RegistryFunctionError } from "@/features/canon/repository";
import { EmbeddingError, geminiEmbedder } from "@/lib/ai/gemini-embeddings";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { getGeminiApiKeys } from "@/lib/env";
import { logError, logInfo } from "@/lib/logger";
import { canBuildIndex, canReviewSubject, canSearchCanon } from "@/lib/permissions";
import { CanonSearchSchema } from "@/lib/validation/schemas";
import { relevant } from "./domain/context";
import { embeddingCount, fullTextRetriever, pendingEmbeddings, rebuildIndex, semanticRetriever, storeEmbeddings } from "./repository";
import type { IndexResult, RetrievalErrorCode, RetrievalMethod, RetrievedChunk, SearchResult, SemanticIndexResult } from "./types";

function databaseCode(error: unknown): RetrievalErrorCode {
  if (error instanceof EmbeddingError) return error.code;
  if (error instanceof RegistryFunctionError && (error.databaseMessage === "FORBIDDEN" || error.databaseMessage === "VALIDATION")) return error.databaseMessage;
  return "UNAVAILABLE";
}

/**
 * POST (Server Action) searchCanonAction
 * Role required: canon.review (own subjects) or canon.publish (all).
 * Body: FormData { query (2 to 500 characters), subjectId? }.
 * Ranks by meaning (Gemini embeddings fused with full-text, PDL-023) when a key is configured and the semantic
 * index exists, otherwise by words; a Gemini failure falls back to words and says so. Returns only chunks that
 * count as evidence; none means refused (no evidence in the canon). The database scopes, filters active
 * versions and audits the retrieval (query stored as a hash only). Only the query text goes to Google.
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
    const request = { actorUserId: actor.userId, query: parsed.data.query, subjectId, k: RETRIEVAL_RESULT_COUNT };
    const apiKeys = getGeminiApiKeys();
    let method: RetrievalMethod = "full_text";
    let fallback: RetrievalErrorCode | null = null;
    let retrieved: RetrievedChunk[] = [];
    if (apiKeys.length > 0 && (await embeddingCount(admin, EMBEDDING_MODEL)) > 0) {
      try {
        retrieved = await semanticRetriever(admin, geminiEmbedder(apiKeys)).retrieve(request);
        method = "semantic";
      } catch (error) {
        if (!(error instanceof EmbeddingError)) throw error;
        fallback = error.code;
        logError("retrieval/actions.searchCanonAction", error);
      }
    }
    if (method === "full_text") retrieved = await fullTextRetriever(admin).retrieve(request);
    const results = relevant(retrieved, RETRIEVAL_MIN_RANK, RETRIEVAL_MIN_SIMILARITY);
    return { success: true, data: { results, refused: results.length === 0, method, fallback } };
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
 * next click continues. Runs where the server can reach Google (the Director's machine, later the hosting).
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
  const started = Date.now();
  let stored = 0;
  let complete = false;
  try {
    while (Date.now() - started < EMBEDDING_BUILD_BUDGET_MS) {
      const pending = await pendingEmbeddings(admin, actor.userId, embedder.model, EMBEDDING_BATCH_SIZE);
      if (pending.length === 0) {
        complete = true;
        break;
      }
      const vectors = await embedder.embedDocuments(pending.map((chunk) => ({ title: chunk.title, text: chunk.content })));
      stored += await storeEmbeddings(admin, {
        actorUserId: actor.userId,
        model: embedder.model,
        rows: pending.map((chunk, index) => ({ chunkId: chunk.chunkId, contentSha256: chunk.contentSha256, embedding: vectors[index] })),
        ipAddress,
      });
    }
    const embedded = await embeddingCount(admin, embedder.model);
    logInfo("retrieval/actions.buildSemanticIndexAction", "semantic index built", { stored, embedded, complete });
    revalidatePath(SEARCH_PATH);
    return { success: true, data: { stored, embedded, complete } };
  } catch (error) {
    const code = databaseCode(error);
    logError("retrieval/actions.buildSemanticIndexAction", error);
    if (stored > 0) revalidatePath(SEARCH_PATH);
    return { success: false, code };
  }
}
