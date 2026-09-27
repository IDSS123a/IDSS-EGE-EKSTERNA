"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { RETRIEVAL_MIN_RANK, RETRIEVAL_RESULT_COUNT, SEARCH_PATH } from "@/constants";
import { auditIfFailed, formId } from "@/features/audit/failures";
import { clientIpFrom } from "@/features/authentication/domain";
import { getCurrentAccount } from "@/features/authentication/session";
import { RegistryFunctionError } from "@/features/canon/repository";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { logError, logInfo } from "@/lib/logger";
import { canBuildIndex, canReviewSubject, canSearchCanon } from "@/lib/permissions";
import { CanonSearchSchema } from "@/lib/validation/schemas";
import { relevant } from "./domain/context";
import { fullTextRetriever, rebuildIndex } from "./repository";
import type { IndexResult, RetrievalErrorCode, SearchResult } from "./types";

function databaseCode(error: unknown): RetrievalErrorCode {
  if (error instanceof RegistryFunctionError && (error.databaseMessage === "FORBIDDEN" || error.databaseMessage === "VALIDATION")) return error.databaseMessage;
  return "UNAVAILABLE";
}

/**
 * POST (Server Action) searchCanonAction
 * Role required: canon.review (own subjects) or canon.publish (all).
 * Body: FormData { query (2 to 500 characters), subjectId? }.
 * Returns only chunks at or above the relevance floor; none means refused (no evidence in the canon).
 * The database scopes, filters active versions and audits the retrieval (query stored as a hash only).
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
    const retriever = fullTextRetriever(createSupabaseAdminClient());
    const results = relevant(await retriever.retrieve({ actorUserId: actor.userId, query: parsed.data.query, subjectId, k: RETRIEVAL_RESULT_COUNT }), RETRIEVAL_MIN_RANK);
    return { success: true, data: { results, refused: results.length === 0 } };
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
