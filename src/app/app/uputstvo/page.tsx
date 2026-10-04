import type { ReactNode } from "react";
import { requireAccount } from "@/features/authentication/session";
import { GuideScreen } from "@/features/guide/components/guide-screen";
import { buildGuide, GUIDE_CHOICES } from "@/features/guide/content";
import { guideReader } from "@/features/guide/reader";
import { listSubjects } from "@/features/knowledge/repository";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { logError } from "@/lib/logger";

/**
 * GET /app/uputstvo — the personal user guide (PDL-031). Role required: any active account; each account reads its own
 * guide. The superadministrator may open every participant's guide with ?vodic=<key> to read or print it.
 */
export default async function GuidePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<ReactNode> {
  const account = await requireAccount();
  const { vodic } = await searchParams;
  const director = account.role === "superadmin";
  let reader;
  try {
    const admin = createSupabaseAdminClient();
    reader = await guideReader(admin, account, await listSubjects(admin));
  } catch (error) {
    logError("app/uputstvo/page", error);
    throw error;
  }
  const chosen = director ? GUIDE_CHOICES.find((choice) => choice.key === vodic) : undefined;
  const guide = buildGuide(chosen && chosen.key !== "direktor" ? chosen.reader : reader);
  return <GuideScreen guide={guide} choices={director ? GUIDE_CHOICES.map(({ key, label }) => ({ key, label })) : null} selected={chosen?.key ?? "direktor"} />;
}
