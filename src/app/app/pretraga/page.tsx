import type { ReactNode } from "react";
import { ForbiddenScreen } from "@/features/accounts/components/forbidden-screen";
import { requireAccount } from "@/features/authentication/session";
import { listSubjects } from "@/features/knowledge/repository";
import { SearchScreen } from "@/features/retrieval/components/search-screen";
import { chunkCounts } from "@/features/retrieval/repository";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { logError } from "@/lib/logger";
import { canBuildIndex, canReviewSubject, canSearchCanon } from "@/lib/permissions";

/**
 * GET /app/pretraga — search over trusted canon (Sprint 05).
 * Role required: canon.review (own subjects) or canon.publish (all subjects, index build).
 * Reads use the user-scoped client (RLS); searching runs through searchCanonAction.
 */
export default async function SearchPage(): Promise<ReactNode> {
  const account = await requireAccount();
  if (!canSearchCanon(account)) return <ForbiddenScreen />;
  let view;
  try {
    const client = await createSupabaseServerClient();
    const [subjects, counts] = await Promise.all([listSubjects(client), chunkCounts(client)]);
    const own = subjects.filter((subject) => canReviewSubject(account, subject.id));
    view = { own, total: own.reduce((sum, subject) => sum + (counts.get(subject.id) ?? 0), 0) };
  } catch (error) {
    logError("app/pretraga/page", error);
    throw error;
  }
  return <SearchScreen subjects={view.own.map((subject) => ({ id: subject.id, code: subject.code }))} chunkTotal={view.total} canBuild={canBuildIndex(account)} />;
}
