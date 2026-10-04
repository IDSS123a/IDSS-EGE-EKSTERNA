import type { ReactNode } from "react";
import { ForbiddenScreen } from "@/features/accounts/components/forbidden-screen";
import { requireAccount } from "@/features/authentication/session";
import { SendTestScreen } from "@/features/grading/components/send-test-screen";
import { sendOptions, sentTests } from "@/features/grading/repository";
import { listSubjects } from "@/features/knowledge/repository";
import { supportOverview } from "@/features/support/repository";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { logError } from "@/lib/logger";
import { canGrade, canGradeSubject } from "@/lib/permissions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /app/ocjenjivanje/posalji — the teacher sends a whole test or part of it to all students of the own subject or to
 * chosen ones (PDL-043). Role required: exams.grade (own subjects; the database re-checks the subject scope).
 * Query (optional, from the student profile): predmet (subject code), ucenik (person id), oblast (area label) preselect
 * the subject, the student and the positions whose catalogue ranges cover that area.
 */
export default async function SendTestPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<ReactNode> {
  const account = await requireAccount();
  if (!canGrade(account)) return <ForbiddenScreen />;
  const query = await searchParams;
  const one = (value: string | string[] | undefined): string | null => (typeof value === "string" && value.length > 0 && value.length <= 200 ? value : null);
  let view;
  try {
    const admin = createSupabaseAdminClient();
    const subjects = (await listSubjects(admin)).filter((subject) => canGradeSubject(account, subject.id));
    const [options, students, sent] = await Promise.all([
      Promise.all(subjects.map((subject) => sendOptions(admin, account.userId, subject))),
      supportOverview(admin, account.userId),
      sentTests(admin, account.userId),
    ]);
    view = { options, students: students.map((student) => ({ personId: student.personId, name: student.name })), sent };
  } catch (error) {
    logError("app/ocjenjivanje/posalji/page", error);
    throw error;
  }
  const student = one(query.ucenik);
  return (
    <SendTestScreen
      options={view.options}
      students={view.students}
      sent={view.sent}
      preset={{ subject: one(query.predmet), student: student && UUID.test(student) ? student : null, area: one(query.oblast) }}
    />
  );
}
