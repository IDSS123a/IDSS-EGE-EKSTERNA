import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RegistryFunctionError } from "@/features/canon/repository";
import type { SubjectCode } from "@/features/knowledge/types";
import type { AppSettings } from "@/features/settings/app-settings";
import { gamificationValues } from "./config";
import type { GamificationOverview } from "./types";

type Row = {
  xp: { answers: number | string; missions: number | string; practice_days: number | string; exams_submitted: number | string; exams_graded: number | string };
  badges: { first_answer: boolean; streak: boolean; answers_in_subject: SubjectCode[]; first_mock_exam: SubjectCode[]; all_subjects: boolean };
};

/**
 * gamification_overview (migration 025): XP and badges derived read-only from the student's own events.
 * Service-role client after the page has authorised the student; the function re-checks practice.participate.
 * @throws RegistryFunctionError with the database's machine message
 */
export async function gamificationOverview(admin: SupabaseClient, actorUserId: string, settings: AppSettings): Promise<GamificationOverview> {
  const { data, error } = await admin.rpc("gamification_overview", { p_actor: actorUserId, p_values: gamificationValues(settings) });
  if (error) throw new RegistryFunctionError(error.message);
  const row = data as Row;
  return {
    xp: {
      answers: Number(row.xp.answers),
      missions: Number(row.xp.missions),
      practiceDays: Number(row.xp.practice_days),
      examsSubmitted: Number(row.xp.exams_submitted),
      examsGraded: Number(row.xp.exams_graded),
    },
    badges: {
      firstAnswer: row.badges.first_answer,
      streak: row.badges.streak,
      answersInSubject: row.badges.answers_in_subject ?? [],
      firstMockExam: row.badges.first_mock_exam ?? [],
      allSubjects: row.badges.all_subjects,
    },
  };
}
