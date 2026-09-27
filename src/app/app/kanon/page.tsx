import type { ReactNode } from "react";
import { ForbiddenScreen } from "@/features/accounts/components/forbidden-screen";
import { requireAccount } from "@/features/authentication/session";
import { CanonScreen } from "@/features/canon/components/canon-screen";
import { findDisplayNames, loadRegistry } from "@/features/canon/repository";
import { latestJobs } from "@/features/ingestion/repository";
import type { FactsStatus } from "@/features/knowledge/components/facts-panel";
import { factsForSha256 } from "@/features/knowledge/domain/facts";
import { versionsWithFacts } from "@/features/knowledge/repository";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { logError } from "@/lib/logger";
import { canPublishCanon, canViewCanon } from "@/lib/permissions";

/**
 * GET /app/kanon — canon registry (Sprint 02).
 * Role required: canon.review (read) or canon.publish (upload and lifecycle changes).
 * The registry is read with the user-scoped client, so RLS limits what is visible even if this
 * check were wrong; only staff display names for the history are read with the service role.
 */
export default async function CanonPage(): Promise<ReactNode> {
  const account = await requireAccount();
  if (!canViewCanon(account)) return <ForbiddenScreen />;

  let registry;
  let jobs;
  let facts: Record<string, FactsStatus>;
  try {
    const admin = createSupabaseAdminClient();
    const client = await createSupabaseServerClient();
    registry = await loadRegistry(client, (ids) => findDisplayNames(admin, ids));
    jobs = Object.fromEntries(await latestJobs(client, registry.documents.flatMap((document) => document.versions.map((version) => version.id))));
    // Subject and rules come from catalogue editions that have reviewed facts (PDL-015).
    const catalogueVersions = registry.documents.filter((document) => document.typeCode === "subject_catalogue").flatMap((document) => document.versions);
    const loaded = await versionsWithFacts(client, catalogueVersions.map((version) => version.id));
    facts = Object.fromEntries(catalogueVersions.map((version) => [version.id, { available: factsForSha256(version.sha256) !== null, loadedRules: loaded.get(version.id) ?? 0 }]));
  } catch (error) {
    // Logged with location here; the /app error boundary shows the friendly message.
    logError("app/kanon/page", error);
    throw error;
  }
  return <CanonScreen registry={registry} jobs={jobs} facts={facts} canPublish={canPublishCanon(account)} />;
}
