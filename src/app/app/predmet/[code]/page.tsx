import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ForbiddenScreen } from "@/features/accounts/components/forbidden-screen";
import { requireAccount } from "@/features/authentication/session";
import { SUBJECT_CODES, type SubjectCode } from "@/features/knowledge/types";
import { SubjectScreen } from "@/features/practice/components/subject-screen";
import { practiceOverview } from "@/features/practice/repository";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { logError } from "@/lib/logger";
import { canPractise } from "@/lib/permissions";

/**
 * GET /app/predmet/[code] — one subject of the Game Hub with its areas (Sprint 06).
 * Role required: practice.participate (students); the database re-checks it.
 */
export default async function SubjectPage({ params }: { params: Promise<{ code: string }> }): Promise<ReactNode> {
  const account = await requireAccount();
  if (!canPractise(account)) return <ForbiddenScreen />;
  const code = (await params).code;
  if (!SUBJECT_CODES.includes(code as SubjectCode)) notFound();
  let areas;
  try {
    const overview = await practiceOverview(createSupabaseAdminClient(), account.userId);
    areas = overview.areas.filter((area) => area.subjectCode === code);
  } catch (error) {
    logError("app/predmet/page", error);
    throw error;
  }
  return <SubjectScreen code={code as SubjectCode} areas={areas} />;
}
