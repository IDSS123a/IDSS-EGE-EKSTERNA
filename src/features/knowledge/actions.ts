"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { CANON_PATH, REVIEW_PATH } from "@/constants";
import { auditIfFailed, formId } from "@/features/audit/failures";
import { clientIpFrom } from "@/features/authentication/domain";
import { getCurrentAccount } from "@/features/authentication/session";
import { sha256Hex } from "@/features/canon/domain";
import { RegistryFunctionError, downloadObject } from "@/features/canon/repository";
import { readPdfText } from "@/features/ingestion/pdf-lines";
import { findVersionForIngestion } from "@/features/ingestion/repository";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { logError, logInfo } from "@/lib/logger";
import { canPublishCanon, canReviewSubject } from "@/lib/permissions";
import { FactsLoadSchema, RuleReviewSchema } from "@/lib/validation/schemas";
import { FACTS_VERSION, factsForSha256, missingQuotes } from "./domain/facts";
import { knowledgeErrorFromDatabase } from "./domain/errors";
import { decideRuleReview, loadCanonicalFacts } from "./repository";
import type { KnowledgeActionResult } from "./types";

async function requestIp(): Promise<string | null> {
  return clientIpFrom((await headers()).get("x-forwarded-for"));
}

/**
 * POST (Server Action) loadCanonicalFactsAction
 * Role required: canon.publish.
 * Body: FormData { versionId } of an active catalogue version or one awaiting validation.
 * Picks the reviewed facts for that exact edition (config/canonical-facts.json, by SHA-256),
 * re-checks the stored file's SHA-256, verifies every quote on its page in the stored PDF and
 * stores subject and rules in one transaction (load_canonical_facts, migration 008).
 * Errors: UNAUTHENTICATED, FORBIDDEN, VALIDATION, NOT_FOUND, INVALID_TRANSITION, NO_FACTS,
 *   SOURCE_MISSING, INTEGRITY, QUOTE_MISMATCH, ALREADY_LOADED, UNAVAILABLE.
 */
export async function loadCanonicalFactsAction(_previous: KnowledgeActionResult | null, formData: FormData): Promise<KnowledgeActionResult> {
  const result = await loadFacts(formData);
  return auditIfFailed(result, { action: "canon.facts_load", entityType: "canonical_document_version", entityId: formId(formData, "versionId") });
}

async function loadFacts(formData: FormData): Promise<KnowledgeActionResult> {
  const actor = await getCurrentAccount();
  if (!actor) return { success: false, code: "UNAUTHENTICATED" };
  if (!canPublishCanon(actor)) return { success: false, code: "FORBIDDEN" };
  const parsed = FactsLoadSchema.safeParse({ versionId: formData.get("versionId") });
  if (!parsed.success) return { success: false, code: "VALIDATION" };

  try {
    const admin = createSupabaseAdminClient();
    const version = await findVersionForIngestion(admin, parsed.data.versionId);
    if (!version) return { success: false, code: "NOT_FOUND" };
    if (version.status !== "active" && version.status !== "validation_required") return { success: false, code: "INVALID_TRANSITION" };
    const edition = factsForSha256(version.sha256);
    if (!edition) return { success: false, code: "NO_FACTS" };
    const bytes = await downloadObject(admin, version.storagePath);
    if (!bytes) return { success: false, code: "SOURCE_MISSING" };
    if ((await sha256Hex(bytes)) !== version.sha256) return { success: false, code: "INTEGRITY" };
    const missing = missingQuotes(edition, await readPdfText(bytes));
    if (missing.length > 0) {
      logError("knowledge/actions.loadCanonicalFactsAction", new Error("quote not found in source"), { owner: missing[0].owner, page: String(missing[0].page) });
      return { success: false, code: "QUOTE_MISMATCH", detail: `${missing[0].owner}, p. ${missing[0].page}` };
    }
    await loadCanonicalFacts(admin, { actorUserId: actor.userId, versionId: version.id, factsVersion: FACTS_VERSION, edition, ipAddress: await requestIp() });
    logInfo("knowledge/actions.loadCanonicalFactsAction", "canonical facts loaded", { subject: edition.subject.code, rules: edition.rules.length });
    revalidatePath(CANON_PATH);
    revalidatePath(REVIEW_PATH, "layout");
    return { success: true, data: { message: "FACTS_LOADED", rules: edition.rules.length } };
  } catch (error) {
    const code = error instanceof RegistryFunctionError ? knowledgeErrorFromDatabase(error.databaseMessage) : "UNAVAILABLE";
    if (code === "UNAVAILABLE") logError("knowledge/actions.loadCanonicalFactsAction", error);
    return { success: false, code };
  }
}

/**
 * POST (Server Action) decideRuleReviewAction
 * Role required: canon.review for the rule's subject (or canon.publish).
 * Body: FormData { ruleId, subjectId, decision: confirmed|disputed, note (required when disputed) }.
 * The database re-checks the scope against the rule's own subject (the form's subjectId is only a pre-check).
 * Errors: UNAUTHENTICATED, FORBIDDEN, VALIDATION, NOT_FOUND, UNAVAILABLE.
 */
export async function decideRuleReviewAction(_previous: KnowledgeActionResult | null, formData: FormData): Promise<KnowledgeActionResult> {
  const result = await decideRule(formData);
  return auditIfFailed(result, { action: "review.rule_decision", entityType: "canonical_rule", entityId: formId(formData, "ruleId") });
}

async function decideRule(formData: FormData): Promise<KnowledgeActionResult> {
  const actor = await getCurrentAccount();
  if (!actor) return { success: false, code: "UNAUTHENTICATED" };
  const parsed = RuleReviewSchema.safeParse({
    ruleId: formData.get("ruleId"),
    subjectId: formData.get("subjectId"),
    decision: formData.get("decision"),
    note: formData.get("note") ?? undefined,
  });
  if (!parsed.success) return { success: false, code: "VALIDATION" };
  if (!canReviewSubject(actor, parsed.data.subjectId)) return { success: false, code: "FORBIDDEN" };
  try {
    await decideRuleReview(createSupabaseAdminClient(), { actorUserId: actor.userId, ruleId: parsed.data.ruleId, decision: parsed.data.decision, note: parsed.data.note ?? null, ipAddress: await requestIp() });
  } catch (error) {
    const code = error instanceof RegistryFunctionError ? knowledgeErrorFromDatabase(error.databaseMessage) : "UNAVAILABLE";
    if (code === "UNAVAILABLE") logError("knowledge/actions.decideRuleReviewAction", error);
    return { success: false, code };
  }
  revalidatePath(REVIEW_PATH, "layout");
  return { success: true, data: { message: parsed.data.decision === "confirmed" ? "RULE_CONFIRMED" : "RULE_DISPUTED" } };
}
