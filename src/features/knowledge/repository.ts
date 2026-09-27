import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RegistryFunctionError } from "@/features/canon/repository";
import type { EditionFacts } from "./domain/facts";
import type { CanonicalRule, Subject, SubjectCode } from "./types";

/**
 * Database access for subjects and canonical rules (A-3). Reads use the caller's client (RLS);
 * writes go through the migration 008 functions with the service-role client, after the action
 * has authorised the caller.
 */

type SubjectRow = { id: string; code: SubjectCode; official_name: string; legal_basis: string; source_version_id: string; evidence: { page: number; quote: string }[] };

/** All exam subjects in the order of Pravilnik Art. 5 (B/H/S, Matematika, first foreign language). */
export async function listSubjects(client: SupabaseClient): Promise<Subject[]> {
  const { data, error } = await client.from("subjects").select("id, code, official_name, legal_basis, source_version_id, evidence").returns<SubjectRow[]>();
  if (error) throw new Error(`listSubjects failed: ${error.message}`);
  const order: SubjectCode[] = ["bhs_language_literature", "mathematics", "german"];
  return (data ?? [])
    .map((row) => ({ id: row.id, code: row.code, officialName: row.official_name, legalBasis: row.legal_basis, sourceVersionId: row.source_version_id, evidence: row.evidence }))
    .sort((a, b) => order.indexOf(a.code) - order.indexOf(b.code));
}

/** True when the subject row exists (service role; used before scoped grants). */
export async function subjectExists(admin: SupabaseClient, subjectId: string): Promise<boolean> {
  const { data, error } = await admin.from("subjects").select("id").eq("id", subjectId).maybeSingle();
  if (error) throw new Error(`subjectExists failed: ${error.message}`);
  return data !== null;
}

/** Version ids whose canonical facts are already loaded (caller's client). */
export async function versionsWithFacts(client: SupabaseClient, versionIds: string[]): Promise<Map<string, number>> {
  const loaded = new Map<string, number>();
  if (versionIds.length === 0) return loaded;
  const { data, error } = await client.from("canonical_rules").select("source_version_id").in("source_version_id", versionIds);
  if (error) throw new Error(`versionsWithFacts failed: ${error.message}`);
  for (const row of (data ?? []) as { source_version_id: string }[]) loaded.set(row.source_version_id, (loaded.get(row.source_version_id) ?? 0) + 1);
  return loaded;
}

type RuleRow = { id: string; subject_id: string; source_version_id: string; rule_code: string; value: Record<string, unknown>; evidence: { page: number; quote: string }[]; loaded_at: string };
type RuleReviewRow = { rule_id: string; decision: "confirmed" | "disputed"; note: string | null; reviewer: string; decided_at: string };

/**
 * Rules of the current source version of each given subject, with the latest review (caller's client, RLS).
 * @param reviewerNames display names by user id, for the review line
 */
export async function listRules(client: SupabaseClient, subjects: Subject[], reviewerNames: (ids: string[]) => Promise<Map<string, string>>): Promise<CanonicalRule[]> {
  if (subjects.length === 0) return [];
  const { data, error } = await client
    .from("canonical_rules")
    .select("id, subject_id, source_version_id, rule_code, value, evidence, loaded_at")
    .in("source_version_id", subjects.map((subject) => subject.sourceVersionId))
    .order("loaded_at", { ascending: true })
    .returns<RuleRow[]>();
  if (error) throw new Error(`listRules failed: ${error.message}`);
  const rules = data ?? [];
  const reviews = new Map<string, RuleReviewRow>();
  if (rules.length > 0) {
    const result = await client
      .from("canonical_rule_reviews")
      .select("rule_id, decision, note, reviewer, decided_at")
      .in("rule_id", rules.map((rule) => rule.id))
      .order("decided_at", { ascending: false })
      .returns<RuleReviewRow[]>();
    if (result.error) throw new Error(`listRules(reviews) failed: ${result.error.message}`);
    for (const row of result.data ?? []) if (!reviews.has(row.rule_id)) reviews.set(row.rule_id, row);
  }
  const names = await reviewerNames([...new Set([...reviews.values()].map((review) => review.reviewer))]);
  return rules.map((rule) => {
    const review = reviews.get(rule.id);
    return {
      id: rule.id,
      subjectId: rule.subject_id,
      sourceVersionId: rule.source_version_id,
      ruleCode: rule.rule_code,
      value: rule.value,
      evidence: rule.evidence,
      review: review ? { decision: review.decision, note: review.note, reviewerName: names.get(review.reviewer) ?? null, decidedAt: review.decided_at } : null,
    };
  });
}

/**
 * load_canonical_facts (migration 008): subject, rules, document scope, dependency rows and audit row in one transaction.
 * @throws RegistryFunctionError with the database's machine message
 */
export async function loadCanonicalFacts(admin: SupabaseClient, input: { actorUserId: string; versionId: string; factsVersion: number; edition: EditionFacts; ipAddress: string | null }): Promise<string> {
  const { data, error } = await admin.rpc("load_canonical_facts", {
    p_actor: input.actorUserId,
    p_version_id: input.versionId,
    p_facts: { sha256: input.edition.sha256, facts_version: input.factsVersion, subject: input.edition.subject, rules: input.edition.rules },
    p_ip: input.ipAddress,
  });
  if (error) throw new RegistryFunctionError(error.message);
  return data as string;
}

/**
 * decide_rule_review (migration 008), scoped to the rule's subject in the database.
 * @throws RegistryFunctionError with the database's machine message
 */
export async function decideRuleReview(admin: SupabaseClient, input: { actorUserId: string; ruleId: string; decision: "confirmed" | "disputed"; note: string | null; ipAddress: string | null }): Promise<void> {
  const { error } = await admin.rpc("decide_rule_review", { p_actor: input.actorUserId, p_rule_id: input.ruleId, p_decision: input.decision, p_note: input.note, p_ip: input.ipAddress });
  if (error) throw new RegistryFunctionError(error.message);
}

/** Display names of staff accounts by user id (service role; names only, for review attribution). */
export async function displayNames(admin: SupabaseClient, userIds: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (userIds.length === 0) return names;
  const { data, error } = await admin.from("profiles").select("user_id, display_name").in("user_id", userIds);
  if (error) throw new Error(`displayNames failed: ${error.message}`);
  for (const row of (data ?? []) as { user_id: string; display_name: string }[]) names.set(row.user_id, row.display_name);
  return names;
}
