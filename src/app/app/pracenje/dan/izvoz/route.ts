import { headers } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { clientIpFrom } from "@/features/authentication/domain";
import { insertAuditLog } from "@/features/authentication/repository";
import { getCurrentAccount } from "@/features/authentication/session";
import { daysSince, share, summaryDay } from "@/features/support/domain/indicators";
import { exportDictionary, idssCsvResponse } from "@/features/support/export";
import { dailySummary } from "@/features/support/repository";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { logError } from "@/lib/logger";
import { canViewStudentProgress, hasCapability } from "@/lib/permissions";

/**
 * GET /app/pracenje/dan/izvoz?d=YYYY-MM-DD — the daily summary as IDSS CSV (PDL-036). Role required:
 * students.view_progress (own subjects for a teacher) and reports.export. Facts only, no note; audited.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const account = await getCurrentAccount();
  if (!account) return new NextResponse("Unauthorized", { status: 401 });
  if (!canViewStudentProgress(account) || !hasCapability(account, "reports.export")) return new NextResponse("Forbidden", { status: 403 });
  try {
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Sarajevo" });
    const day = summaryDay(request.nextUrl.searchParams.get("d") ?? undefined, today);
    const admin = createSupabaseAdminClient();
    const summary = await dailySummary(admin, account.userId, day);
    const dictionary = await exportDictionary();
    const labels = dictionary.support.daily;
    const rows: (string | number | null)[][] = [[labels.day, day], []];
    for (const subject of summary.subjects) {
      rows.push([dictionary.subjects[subject.code]]);
      rows.push([labels.practisedCount, subject.practised.length, labels.notPractisedCount, subject.notPractised.length, labels.examsSubmitted, subject.examsSubmitted]);
      rows.push([labels.practised], [dictionary.support.columns.student, labels.answers, labels.accuracy]);
      for (const row of subject.practised) rows.push([row.name, row.answers, share(row.correct, row.checked) ?? ""]);
      rows.push([labels.notPractised], [dictionary.support.columns.student, labels.lastPractice, labels.daysWithout]);
      for (const row of subject.notPractised) rows.push([row.name, row.lastPractice?.slice(0, 10) ?? "", row.lastPractice ? (daysSince(row.lastPractice, day) ?? "") : ""]);
      rows.push([labels.areas], [dictionary.support.analysis.area, dictionary.support.analysis.checked, dictionary.support.analysis.correctShare]);
      for (const area of subject.areas.filter((entry) => entry.checked > 0)) rows.push([area.area, area.checked, share(area.correct, area.checked) ?? ""]);
      rows.push([]);
    }
    await insertAuditLog(admin, { actorUserId: account.userId, action: "support.daily_exported", entityType: "persons", ipAddress: clientIpFrom((await headers()).get("x-forwarded-for")), details: { day } });
    return await idssCsvResponse({ title: `${labels.title} ${day}`, confidential: true, rows });
  } catch (error) {
    logError("app/pracenje/dan/izvoz.GET", error);
    return new NextResponse("Unavailable", { status: 503 });
  }
}
