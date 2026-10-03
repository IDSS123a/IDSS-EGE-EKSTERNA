import type { ReactNode } from "react";
import { ForbiddenScreen } from "@/features/accounts/components/forbidden-screen";
import { requireAccount } from "@/features/authentication/session";
import { GradingHomeScreen } from "@/features/grading/components/grading-home-screen";
import { gradingQueue, subjectBlueprints } from "@/features/grading/repository";
import { displayNames, listSubjects } from "@/features/knowledge/repository";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { logError } from "@/lib/logger";
import { canGrade, canGradeSubject, canPublishCanon, canReviewSubject } from "@/lib/permissions";

/**
 * GET /app/ocjenjivanje — teachers' mock exam area (Sprint 07): sets waiting for approval, exams to grade, recent
 * results and the blueprints of the teacher's subjects. Role required: exams.grade (own subjects; the database scopes
 * the queue again).
 */
export default async function GradingPage(): Promise<ReactNode> {
  const account = await requireAccount();
  if (!canGrade(account)) return <ForbiddenScreen />;
  let view;
  try {
    const client = await createSupabaseServerClient();
    const admin = createSupabaseAdminClient();
    const subjects = (await listSubjects(client)).filter((subject) => canGradeSubject(account, subject.id) || canReviewSubject(account, subject.id));
    const [blueprints, queue] = await Promise.all([subjectBlueprints(client, subjects, (ids) => displayNames(admin, ids)), gradingQueue(admin, account.userId)]);
    view = { blueprints, queue, reviewable: subjects.filter((subject) => canReviewSubject(account, subject.id)).map((subject) => subject.id) };
  } catch (error) {
    logError("app/ocjenjivanje/page", error);
    throw error;
  }
  return <GradingHomeScreen blueprints={view.blueprints} queue={view.queue} reviewable={view.reviewable} canLoad={canPublishCanon(account)} />;
}
