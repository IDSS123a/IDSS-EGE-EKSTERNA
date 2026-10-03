import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { clientIpFrom } from "@/features/authentication/domain";
import { insertAuditLog } from "@/features/authentication/repository";
import { getCurrentAccount } from "@/features/authentication/session";
import { getDictionary, getRequestLocale } from "@/features/localization/server";
import { share, toCsv } from "@/features/support/domain/indicators";
import { supportOverview, visibleSubjectCodes } from "@/features/support/repository";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { logError } from "@/lib/logger";
import { canViewStudentProgress, hasCapability } from "@/lib/permissions";

/**
 * GET /app/pracenje/izvoz — CSV of the student overview (Sprint 09). Role required: students.view_progress (own subjects
 * for a teacher) and reports.export. Contains learning facts only, never a support note; cells are safe against formula injection;
 * every export is audited.
 */
export async function GET(): Promise<Response> {
  const account = await getCurrentAccount();
  if (!account) return new NextResponse("Unauthorized", { status: 401 });
  if (!canViewStudentProgress(account) || !hasCapability(account, "reports.export")) return new NextResponse("Forbidden", { status: 403 });
  try {
    const admin = createSupabaseAdminClient();
    const [students, codes] = await Promise.all([supportOverview(admin, account.userId), visibleSubjectCodes(admin, account)]);
    const dictionary = getDictionary(await getRequestLocale());
    const labels = dictionary.support.csv;
    const header = [labels.student, labels.lastActivity, labels.days7, labels.days30];
    for (const code of codes) {
      const name = dictionary.subjects[code];
      header.push(`${name}: ${labels.mastered}`, `${name}: ${labels.accuracy}`, `${name}: ${labels.latestExam}`, `${name}: ${labels.readiness}`);
    }
    const rows: (string | number | null)[][] = [header];
    for (const student of students) {
      const row: (string | number | null)[] = [student.name, student.lastActivity?.slice(0, 10) ?? "", student.days7, student.days30];
      for (const code of codes) {
        const subject = student.subjects.find((entry) => entry.code === code);
        const latest = subject?.exams[0];
        row.push(
          subject ? `${subject.mastered}/${subject.total}` : "",
          subject ? (share(subject.correct30, subject.checked30) ?? "") : "",
          latest ? `${latest.points}/${latest.max}` : "",
          subject ? subject.readiness.state : "",
        );
      }
      rows.push(row);
    }
    await insertAuditLog(admin, { actorUserId: account.userId, action: "support.overview_exported", entityType: "persons", ipAddress: clientIpFrom((await headers()).get("x-forwarded-for")), details: { rows: String(students.length) } });
    return new NextResponse(toCsv(rows), {
      status: 200,
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="pracenje-ucenika.csv"', "cache-control": "no-store" },
    });
  } catch (error) {
    logError("app/pracenje/izvoz.GET", error);
    return new NextResponse("Unavailable", { status: 503 });
  }
}
