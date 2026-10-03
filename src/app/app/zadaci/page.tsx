import type { ReactNode } from "react";
import { ForbiddenScreen } from "@/features/accounts/components/forbidden-screen";
import { AssignmentsHomeScreen } from "@/features/assignments/components/assignments-home-screen";
import { assignmentFormOptions, assignmentsOverview } from "@/features/assignments/repository";
import { requireAccount } from "@/features/authentication/session";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { logError } from "@/lib/logger";
import { canManageAssignments } from "@/lib/permissions";

/**
 * GET /app/zadaci — Zadaci za učenike (PDL-035). Role required: assignments.manage (subject teacher for the own
 * subjects, superadministrator); the database re-checks the subject scope.
 */
export default async function AssignmentsPage(): Promise<ReactNode> {
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
  return <AssignmentsHomeScreen assignments={view.assignments} options={view.options} />;
}
