import { headers } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { AUDIT_EXPORT_MAX } from "@/constants";
import { clientIpFrom } from "@/features/authentication/domain";
import { insertAuditLog } from "@/features/authentication/repository";
import { getCurrentAccount } from "@/features/authentication/session";
import { parseAuditFilter, parsePeriod, periodStart } from "@/features/director/domain/period";
import { activeSchoolYearStart, directorAudit, directorTeachers } from "@/features/director/repository";
import { exportDictionary, idssCsvResponse } from "@/features/support/export";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { logError } from "@/lib/logger";
import { canViewAudit, canViewInstitution, hasCapability } from "@/lib/permissions";

/**
 * GET /app/direktor/izvoz?tab=nastavnici|dnevnik — IDSS CSV of the teacher activity or of the audit log (PDL-036,
 * PDL-040). Roles required: analytics.view_institution and reports.export; the audit log also audit.view. At most
 * AUDIT_EXPORT_MAX audit rows; cells are safe against formula injection; every export is audited.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const account = await getCurrentAccount();
  if (!account) return new NextResponse("Unauthorized", { status: 401 });
  if (!canViewInstitution(account) || !hasCapability(account, "reports.export")) return new NextResponse("Forbidden", { status: 403 });
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const tab = params.tab;
  if (tab !== "nastavnici" && tab !== "dnevnik") return new NextResponse("Not Found", { status: 404 });
  if (tab === "dnevnik" && !canViewAudit(account)) return new NextResponse("Forbidden", { status: 403 });
  try {
    const admin = createSupabaseAdminClient();
    const dictionary = await exportDictionary();
    const labels = dictionary.director;
    const ipAddress = clientIpFrom((await headers()).get("x-forwarded-for"));
    if (tab === "nastavnici") {
      const schoolYearStart = await activeSchoolYearStart(admin);
      const period = parsePeriod(params.period, schoolYearStart);
      const teachers = await directorTeachers(admin, account.userId, periodStart(period, new Date(), schoolYearStart));
      const t = labels.teachers;
      const rows: (string | number | null)[][] = [[t.name, t.subjectsColumn, t.records, t.answers, t.setsColumn, t.gradedColumn, t.assignments, t.gifts, t.notes, t.waitingAnswersColumn, t.waitingExamsColumn]];
      for (const teacher of teachers) {
        rows.push([teacher.name, teacher.subjects.map((code) => dictionary.subjects[code]).join(", "), teacher.recordsReviewed + teacher.rulesReviewed, teacher.answersReviewed,
          teacher.setsApproved, teacher.examsGraded, teacher.assignmentsGiven, teacher.giftsGiven, teacher.notesWritten, teacher.waitingAnswers, teacher.waitingExams]);
      }
      await insertAuditLog(admin, { actorUserId: account.userId, action: "director.teachers_exported", entityType: "persons", ipAddress, details: { rows: String(teachers.length), period } });
      return await idssCsvResponse({ title: `${labels.title}: ${labels.tabs.nastavnici}, ${labels.periods[period]}`, confidential: true, rows });
    }
    const filter = parseAuditFilter(params);
    const audit = await directorAudit(admin, account.userId, filter, AUDIT_EXPORT_MAX, 0);
    const a = labels.audit;
    const rows: (string | number | null)[][] = [[a.at, a.action, a.person, a.entity, a.details, a.ip]];
    for (const row of audit.rows) {
      rows.push([row.at, row.action, row.actor ?? "", `${row.entityType}${row.entityId ? ` ${row.entityId}` : ""}`, Object.keys(row.details).length > 0 ? JSON.stringify(row.details) : "", row.ip ?? ""]);
    }
    await insertAuditLog(admin, { actorUserId: account.userId, action: "director.audit_exported", entityType: "audit_logs", ipAddress, details: { rows: String(audit.rows.length), total: String(audit.total) } });
    return await idssCsvResponse({ title: `${labels.title}: ${labels.tabs.dnevnik}`, confidential: true, rows });
  } catch (error) {
    logError("app/direktor/izvoz.GET", error);
    return new NextResponse("Unavailable", { status: 503 });
  }
}
