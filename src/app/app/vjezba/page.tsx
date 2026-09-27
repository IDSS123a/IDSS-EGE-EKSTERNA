import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ForbiddenScreen } from "@/features/accounts/components/forbidden-screen";
import { requireAccount } from "@/features/authentication/session";
import { listSubjects } from "@/features/knowledge/repository";
import { PracticeScreen } from "@/features/practice/components/practice-screen";
import { nextQuestion } from "@/features/practice/repository";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { logError } from "@/lib/logger";
import { canPractise } from "@/lib/permissions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /app/vjezba?predmet=&oblast= — the next practice question of a subject or area (Sprint 06, PDL-018).
 * Role required: practice.participate. The question arrives without any key (practice_next, migration 017).
 */
export default async function PracticePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<ReactNode> {
  const account = await requireAccount();
  if (!canPractise(account)) return <ForbiddenScreen />;
  const params = await searchParams;
  const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const code = single(params.predmet);
  const areaParam = single(params.oblast);
  const areaId = areaParam && UUID.test(areaParam) ? areaParam : null;

  let view;
  try {
    const subject = (await listSubjects(await createSupabaseServerClient())).find((candidate) => candidate.code === code);
    const question = subject ? await nextQuestion(createSupabaseAdminClient(), { actorUserId: account.userId, subjectId: subject.id, areaId }) : null;
    view = { subject, question };
  } catch (error) {
    logError("app/vjezba/page", error);
    throw error;
  }
  if (!view.subject) notFound();
  return <PracticeScreen key={view.question?.questionVersionId ?? "none"} code={view.subject.code} areaId={areaId} question={view.question} />;
}
