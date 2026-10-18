import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { assignmentDetail } from "@/features/assignments/repository";
import { clientIpFrom } from "@/features/authentication/domain";
import { insertAuditLog } from "@/features/authentication/repository";
import { getCurrentAccount } from "@/features/authentication/session";
import { formatDateTime } from "@/features/canon/components/format";
import { getRequestLocale } from "@/features/localization/server";
import { exportDictionary, idssCsvResponse } from "@/features/support/export";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { logError } from "@/lib/logger";
import { canManageAssignments, hasCapability } from "@/lib/permissions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /app/zadaci/[id]/izvoz — one assignment's student facts as IDSS CSV (PDL-036). Role required: assignments.manage
 * and reports.export. Names students, so every export is audited (EXP-1).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const account = await getCurrentAccount();
  if (!account) return new NextResponse("Unauthorized", { status: 401 });
  if (!canManageAssignments(account) || !hasCapability(account, "reports.export")) return new NextResponse("Forbidden", { status: 403 });
  const { id } = await params;
  if (!UUID.test(id)) return new NextResponse("Not found", { status: 404 });
  try {
    const admin = createSupabaseAdminClient();
    const assignment = await assignmentDetail(admin, account.userId, id);
    const dictionary = await exportDictionary();
    const locale = await getRequestLocale();
    const labels = dictionary.assignments;
    const rows: (string | number | null)[][] = [
      [labels.subject, dictionary.subjects[assignment.subject]],
      [labels.detail.due, formatDateTime(assignment.dueAt, locale)],
      [labels.detail.questions, assignment.questions.map((question) => question.key).join(", ")],
      [],
      [dictionary.support.columns.student, labels.detail.answered, labels.detail.correct, labels.detail.completedAt, labels.detail.state],
      ...assignment.recipients.map((row) => [row.name, `${row.answered}/${row.total}`, row.correct, row.completedAt ? formatDateTime(row.completedAt, locale) : "", labels.states[row.state]]),
    ];
    await insertAuditLog(admin, { actorUserId: account.userId, action: "assignment.exported", entityType: "assignments", entityId: id, ipAddress: clientIpFrom((await headers()).get("x-forwarded-for")), details: { rows: String(assignment.recipients.length) } });
    return await idssCsvResponse({ title: assignment.title, confidential: true, rows });
  } catch (error) {
    logError("app/zadaci/[id]/izvoz.GET", error);
    return new NextResponse("Unavailable", { status: 503 });
  }
}
