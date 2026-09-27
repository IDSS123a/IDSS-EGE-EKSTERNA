import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RegistryFunctionError } from "@/features/canon/repository";
import type { SubjectCode } from "@/features/knowledge/types";
import type { AreaProgress, PracticeOverview, PracticeQuestion, PracticeResult } from "./types";

/**
 * Practice data (migration 017, A-3). Every call uses the service-role client after the page or action has
 * authorised the student; the database re-checks practice.participate, never returns a key before the answer and
 * binds every answer to the student's person.
 */

type QuestionRow = {
  question_version_id: string;
  record_key: string;
  subject_id: string;
  area_id: string | null;
  area: string | null;
  task_type: string;
  catalogue_level: string | null;
  text: string;
  stem: string | null;
  options: { label: string; text: string }[];
  has_figure: boolean;
  items: { item: number | null; text: string | null; mode: PracticeQuestion["items"][number]["mode"]; choices: string[] }[];
  transcript: string | null;
  source: { page: number | null; official_title: string };
};

function toQuestion(row: QuestionRow): PracticeQuestion {
  return {
    questionVersionId: row.question_version_id,
    recordKey: row.record_key,
    subjectId: row.subject_id,
    areaId: row.area_id,
    area: row.area,
    taskType: row.task_type,
    catalogueLevel: row.catalogue_level,
    text: row.text,
    stem: row.stem,
    options: row.options ?? [],
    hasFigure: row.has_figure,
    items: row.items.map((item) => ({ item: item.item, text: item.text, mode: item.mode, choices: [...item.choices].sort() })),
    transcript: row.transcript,
    source: { page: row.source.page, officialTitle: row.source.official_title },
  };
}

/**
 * practice_next: an unanswered question first, then one answered wrongly, then the one answered longest ago.
 * @throws RegistryFunctionError with the database's machine message
 */
export async function nextQuestion(admin: SupabaseClient, input: { actorUserId: string; subjectId: string; areaId: string | null }): Promise<PracticeQuestion | null> {
  const { data, error } = await admin.rpc("practice_next", { p_actor: input.actorUserId, p_subject_id: input.subjectId, p_area_id: input.areaId });
  if (error) throw new RegistryFunctionError(error.message);
  return data ? toQuestion(data as QuestionRow) : null;
}

/**
 * practice_submit: checks and stores the answer, then returns the solution.
 * @throws RegistryFunctionError with the database's machine message
 */
export async function submitAnswer(admin: SupabaseClient, input: { actorUserId: string; questionVersionId: string; responses: { item: number | null; response: string }[] }): Promise<PracticeResult> {
  const { data, error } = await admin.rpc("practice_submit", { p_actor: input.actorUserId, p_question_version_id: input.questionVersionId, p_responses: input.responses });
  if (error) throw new RegistryFunctionError(error.message);
  const result = data as { outcome: PracticeResult["outcome"]; items_checked: number; items_correct: number; results: PracticeResult["results"] };
  return { outcome: result.outcome, itemsChecked: result.items_checked, itemsCorrect: result.items_correct, results: result.results };
}

/**
 * practice_overview: counts per subject and area, practice days and today's answers.
 * @throws RegistryFunctionError with the database's machine message
 */
export async function practiceOverview(admin: SupabaseClient, actorUserId: string): Promise<PracticeOverview> {
  const { data, error } = await admin.rpc("practice_overview", { p_actor: actorUserId });
  if (error) throw new RegistryFunctionError(error.message);
  const raw = data as {
    areas: { subject_id: string; subject_code: SubjectCode; area_id: string | null; area: string; ordinal: number; total: number; answered: number; correct: number; awaiting: number }[];
    days: string[];
    today: number;
    today_date: string;
  };
  const areas: AreaProgress[] = raw.areas.map((area) => ({
    subjectId: area.subject_id,
    subjectCode: area.subject_code,
    areaId: area.area_id,
    area: area.area,
    ordinal: area.ordinal,
    total: area.total,
    answered: area.answered,
    correct: area.correct,
    awaiting: area.awaiting,
  }));
  return { areas, days: raw.days, today: raw.today, todayDate: raw.today_date };
}
