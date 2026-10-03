import { NextResponse } from "next/server";
import { getCurrentAccount } from "@/features/authentication/session";
import { share } from "@/features/support/domain/indicators";
import { exportDictionary, idssCsvResponse } from "@/features/support/export";
import { groupPatterns } from "@/features/support/repository";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { logError } from "@/lib/logger";
import { canViewStudentProgress, hasCapability } from "@/lib/permissions";

/**
 * GET /app/pracenje/analiza/izvoz — group analysis as IDSS CSV (PDL-036). Role required: students.view_progress (own
 * subjects for a teacher) and reports.export. Aggregates only, no student named.
 */
export async function GET(): Promise<Response> {
  const account = await getCurrentAccount();
  if (!account) return new NextResponse("Unauthorized", { status: 401 });
  if (!canViewStudentProgress(account) || !hasCapability(account, "reports.export")) return new NextResponse("Forbidden", { status: 403 });
  try {
    const patterns = await groupPatterns(createSupabaseAdminClient(), account.userId);
    const dictionary = await exportDictionary();
    const labels = dictionary.support.analysis;
    const rows: (string | number | null)[][] = [[labels.subtitle.replace("{n}", String(patterns.students))], []];
    rows.push([labels.weeks], [labels.week, labels.activeStudents, labels.answers]);
    for (const week of patterns.weeks) rows.push([week.week, week.students, week.answers]);
    rows.push([], [labels.areas], [dictionary.support.filters.subject, labels.area, labels.checked, labels.correctShare]);
    for (const area of patterns.areas) rows.push([dictionary.subjects[area.subject], area.area, area.checked, share(area.correct, area.checked) ?? ""]);
    rows.push([], [labels.examPoints], [dictionary.support.filters.subject, labels.points, labels.exams]);
    for (const row of patterns.examPoints) rows.push([dictionary.subjects[row.subject], row.points, row.exams]);
    rows.push([], [labels.missed], [dictionary.support.filters.subject, labels.key, labels.wrong, labels.students]);
    for (const row of patterns.missedQuestions) rows.push([dictionary.subjects[row.subject], row.recordKey, row.wrong, row.students]);
    return await idssCsvResponse({ title: labels.title, confidential: false, rows });
  } catch (error) {
    logError("app/pracenje/analiza/izvoz.GET", error);
    return new NextResponse("Unavailable", { status: 503 });
  }
}
