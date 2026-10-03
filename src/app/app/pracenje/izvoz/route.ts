import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { clientIpFrom } from "@/features/authentication/domain";
import { insertAuditLog } from "@/features/authentication/repository";
import { getCurrentAccount } from "@/features/authentication/session";
import { readinessPercent, share } from "@/features/support/domain/indicators";
import { exportDictionary, idssCsvResponse } from "@/features/support/export";
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
    const dictionary = await exportDictionary();
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
          subject ? readinessText(subject.readiness, dictionary.support.readiness) : "",
        );
      }
      rows.push(row);
    }
    await insertAuditLog(admin, { actorUserId: account.userId, action: "support.overview_exported", entityType: "persons", ipAddress: clientIpFrom((await headers()).get("x-forwarded-for")), details: { rows: String(students.length) } });
    return await idssCsvResponse({ title: dictionary.support.title, confidential: true, rows });
  } catch (error) {
    logError("app/pracenje/izvoz.GET", error);
    return new NextResponse("Unavailable", { status: 503 });
  }
}

/** Readiness in words for the export: the percentage, or the label the screen shows (PDL-032). */
function readinessText(readiness: Parameters<typeof readinessPercent>[0], labels: { notAvailable: string; below80: string }): string {
  const percent = readinessPercent(readiness);
  return percent !== null ? `${percent} %` : readiness.state === "below_80" ? labels.below80 : labels.notAvailable;
}
