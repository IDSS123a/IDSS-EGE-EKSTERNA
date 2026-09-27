import type { ReactNode } from "react";
import { ForbiddenScreen } from "@/features/accounts/components/forbidden-screen";
import { requireAccount } from "@/features/authentication/session";
import { CanonScreen } from "@/features/canon/components/canon-screen";
import { findDisplayNames, loadRegistry } from "@/features/canon/repository";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
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

  const admin = createSupabaseAdminClient();
  const registry = await loadRegistry(await createSupabaseServerClient(), (ids) => findDisplayNames(admin, ids));
  return <CanonScreen registry={registry} canPublish={canPublishCanon(account)} />;
}
