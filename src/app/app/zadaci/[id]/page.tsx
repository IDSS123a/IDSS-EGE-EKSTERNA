import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ForbiddenScreen } from "@/features/accounts/components/forbidden-screen";
import { AssignmentDetailScreen } from "@/features/assignments/components/assignment-detail-screen";
import { assignmentDetail } from "@/features/assignments/repository";
import { requireAccount } from "@/features/authentication/session";
import { RegistryFunctionError } from "@/features/canon/repository";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { logError } from "@/lib/logger";
import { canManageAssignments, canViewStudentProgress, hasCapability } from "@/lib/permissions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** GET /app/zadaci/[id] — one assignment with every student's facts (PDL-035). Role required: assignments.manage for its subject. */
export default async function AssignmentPage({ params }: { params: Promise<{ id: string }> }): Promise<ReactNode> {
  const account = await requireAccount();
  if (!canManageAssignments(account)) return <ForbiddenScreen />;
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  let assignment;
  try {
    assignment = await assignmentDetail(createSupabaseAdminClient(), account.userId, id);
  } catch (error) {
    if (error instanceof RegistryFunctionError && error.databaseMessage === "NOT_FOUND") notFound();
    if (error instanceof RegistryFunctionError && error.databaseMessage === "FORBIDDEN") return <ForbiddenScreen />;
    logError("app/zadaci/[id]/page", error);
    throw error;
  }
  return <AssignmentDetailScreen assignment={assignment} canExport={hasCapability(account, "reports.export")} canOpenProfiles={canViewStudentProgress(account)} />;
}
