import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CurrentAccount } from "@/features/authentication/types";
import type { Subject } from "@/features/knowledge/types";
import { canGradeSubject, canPractise, canWriteSupportNotes } from "@/lib/permissions";
import type { GuideReader } from "./content";

/**
 * Which guide the signed-in account reads (PDL-031): the superadministrator the Director's guide, a student the
 * students' guide, the pedagogue or psychologist by the bundle the database holds, everyone else the teachers' guide
 * for the subjects they grade.
 */
export async function guideReader(admin: SupabaseClient, account: CurrentAccount, subjects: readonly Subject[]): Promise<GuideReader> {
  const base = { name: account.displayName, username: account.username, subjects: [] };
  if (account.role === "superadmin") return { ...base, kind: "director" };
  if (canPractise(account)) return { ...base, kind: "student" };
  if (canWriteSupportNotes(account)) {
    const { data, error } = await admin.from("profile_bundles").select("bundle_code").eq("profile_user_id", account.userId).returns<{ bundle_code: string }[]>();
    if (error) throw new Error(`guideReader failed: ${error.message}`);
    return { ...base, kind: (data ?? []).some((row) => row.bundle_code === "psychologist") ? "psychologist" : "pedagogue" };
  }
  return { ...base, kind: "teacher", subjects: subjects.filter((subject) => canGradeSubject(account, subject.id)).map((subject) => subject.code) };
}
