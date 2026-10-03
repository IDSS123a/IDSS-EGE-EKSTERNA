import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { DAILY_MISSION_GOAL } from "@/constants";
import { ForbiddenScreen } from "@/features/accounts/components/forbidden-screen";
import { clientIpFrom } from "@/features/authentication/domain";
import { requireAccount } from "@/features/authentication/session";
import { RegistryFunctionError } from "@/features/canon/repository";
import { StudentProfileScreen } from "@/features/support/components/student-profile-screen";
import { assignmentsOfPerson } from "@/features/assignments/repository";
import { studentProfile, teacherNotes } from "@/features/support/repository";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { logError } from "@/lib/logger";
import { canViewStudentProgress, canWriteTeacherNotes } from "@/lib/permissions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /app/pracenje/[student] — one student's profile (Sprint 09). Role required: students.view_progress; a subject
 * teacher sees only the own subjects, no support note and no all-subject mission (migration 027).
 * Every opening writes an access audit row in the database (ROLES §3).
 */
export default async function StudentProfilePage({ params }: { params: Promise<{ student: string }> }): Promise<ReactNode> {
  const account = await requireAccount();
  if (!canViewStudentProgress(account)) return <ForbiddenScreen />;
  const { student } = await params;
  if (!UUID.test(student)) notFound();
  let profile, notes, assignments;
  try {
    const admin = createSupabaseAdminClient();
    profile = await studentProfile(admin, {
      actorUserId: account.userId,
      personId: student,
      missionGoal: DAILY_MISSION_GOAL,
      ipAddress: clientIpFrom((await headers()).get("x-forwarded-for")),
    });
    [notes, assignments] = await Promise.all([
      canWriteTeacherNotes(account) ? teacherNotes(admin, account.userId, student) : Promise.resolve(null),
      assignmentsOfPerson(admin, account.userId, student),
    ]);
  } catch (error) {
    if (error instanceof RegistryFunctionError && error.databaseMessage === "NOT_FOUND") notFound();
    logError("app/pracenje/[student]/page", error);
    throw error;
  }
  return <StudentProfileScreen profile={profile} teacherNotes={notes} assignments={assignments} />;
}
