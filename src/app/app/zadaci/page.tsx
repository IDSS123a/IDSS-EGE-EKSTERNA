import type { ReactNode } from "react";
import { ForbiddenScreen } from "@/features/accounts/components/forbidden-screen";
import { AssignmentsHomeScreen } from "@/features/assignments/components/assignments-home-screen";
import { assignmentFormOptions, assignmentsOverview } from "@/features/assignments/repository";
import { requireAccount } from "@/features/authentication/session";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { logError } from "@/lib/logger";
import { canManageAssignments } from "@/lib/permissions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /app/zadaci — Zadaci za učenike (PDL-035). Role required: assignments.manage (subject teacher for the own
 * subjects, superadministrator); the database re-checks the subject scope.
 * Query (optional, from a weak area on the student profile, PDL-043): predmet, ucenik, oblast prefill the form.
 */
export default async function AssignmentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<ReactNode> {
  const account = await requireAccount();
  if (!canManageAssignments(account)) return <ForbiddenScreen />;
  let view;
  try {
    const admin = createSupabaseAdminClient();
    const [assignments, options] = await Promise.all([assignmentsOverview(admin, account.userId), assignmentFormOptions(admin, account)]);
    view = { assignments, options };
  } catch (error) {
    logError("app/zadaci/page", error);
    throw error;
  }
  const query = await searchParams;
  const one = (value: string | string[] | undefined): string | null => (typeof value === "string" && value.length > 0 && value.length <= 200 ? value : null);
  const student = one(query.ucenik);
  const preset = { subject: one(query.predmet), student: student && UUID.test(student) ? student : null, area: one(query.oblast) };
  return <AssignmentsHomeScreen assignments={view.assignments} options={view.options} preset={preset} />;
}
