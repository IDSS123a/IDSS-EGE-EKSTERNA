"use client";

import { useActionState, type ReactNode } from "react";
import { formatDateTime } from "@/features/canon/components/format";
import { useI18n } from "@/features/localization/i18n-provider";
import { saveAppSettingAction } from "../actions";
import type { SettingsActionResult } from "../types";

type Gamification = { xp: Record<string, number>; badges: { streak_days: number; answers_in_subject: number } };
type Change = { at: string; by: string | null; before: unknown; after: unknown };

const XP_FIELDS = ["answer_correct", "answer_partly_correct", "answer_incorrect", "mission_completed", "practice_day", "mock_exam_submitted", "mock_exam_point", "mock_exam_points_cap"] as const;

/** The Director's settings (PDL-040 K5): mission goal, minimum group, IDSS points and badges, each with its history. */
export function AppSettingsForms({ missionGoal, minGroup, gamification, history }: {
  missionGoal: number;
  minGroup: number;
  gamification: Gamification;
  history: Record<"mission.daily_goal" | "privacy.min_group" | "gamification.values", Change[]>;
}): ReactNode {
  const { dictionary } = useI18n();
  const labels = dictionary.settings.app;
  return (
    <>
      <SettingForm settingKey="mission.daily_goal" title={labels.mission.title} hint={labels.mission.hint} history={history["mission.daily_goal"]}>
        <div className="form__field">
          <label htmlFor="setting-mission">{labels.mission.label}</label>
          <input id="setting-mission" name="value" type="number" min={1} max={100} step={1} defaultValue={missionGoal} required />
        </div>
      </SettingForm>
      <SettingForm settingKey="privacy.min_group" title={labels.minGroup.title} hint={labels.minGroup.hint} history={history["privacy.min_group"]}>
        <div className="form__field">
          <label htmlFor="setting-min-group">{labels.minGroup.label}</label>
          <input id="setting-min-group" name="value" type="number" min={1} max={50} step={1} defaultValue={minGroup} required />
        </div>
      </SettingForm>
      <SettingForm settingKey="gamification.values" title={labels.points.title} hint={labels.points.hint} history={history["gamification.values"]}>
        <div className="form--grid form">
          {XP_FIELDS.map((field) => (
            <div key={field} className="form__field">
              <label htmlFor={`setting-xp-${field}`}>{labels.points.xp[field]}</label>
              <input id={`setting-xp-${field}`} name={`xp.${field}`} type="number" min={0} max={1000} step="any" defaultValue={gamification.xp[field]} required />
            </div>
          ))}
          <div className="form__field">
            <label htmlFor="setting-streak">{labels.points.streakDays}</label>
            <input id="setting-streak" name="badges.streak_days" type="number" min={1} max={1000} step={1} defaultValue={gamification.badges.streak_days} required />
          </div>
          <div className="form__field">
            <label htmlFor="setting-answers">{labels.points.answersInSubject}</label>
            <input id="setting-answers" name="badges.answers_in_subject" type="number" min={1} max={1000} step={1} defaultValue={gamification.badges.answers_in_subject} required />
          </div>
        </div>
      </SettingForm>
      <p className="form__hint">{labels.canonNote}</p>
    </>
  );
}

function SettingForm({ settingKey, title, hint, history, children }: { settingKey: string; title: string; hint: string; history: Change[]; children: ReactNode }): ReactNode {
  const { dictionary, locale } = useI18n();
  const labels = dictionary.settings;
  const [result, formAction, pending] = useActionState<SettingsActionResult | null, FormData>(saveAppSettingAction, null);
  return (
    <section className="card" aria-labelledby={`setting-${settingKey}`}>
      <h2 id={`setting-${settingKey}`}>{title}</h2>
      <p className="form__hint">{hint}</p>
      <form action={formAction} className="form">
        <input type="hidden" name="key" value={settingKey} />
        {children}
        <div className="form__actions">
          <button type="submit" className="button-primary" disabled={pending}>{pending ? labels.palette.saving : labels.palette.save}</button>
          <p className="action-feedback" aria-live="polite">
            {result?.success && <span className="action-feedback--ok">{labels.app.saved}</span>}
            {result && !result.success && <span className="action-feedback--error">{result.code === "VALIDATION" ? labels.app.invalid : labels.errors[result.code]}</span>}
          </p>
        </div>
      </form>
      {history.length > 0 && (
        <details>
          <summary>{labels.app.history}</summary>
          <ul className="canon-history__list">
            {history.map((change, index) => (
              <li key={`${change.at}-${index}`}>
                <span className="canon-history__event">{formatDateTime(change.at, locale)}{change.by ? `, ${change.by}` : ""}</span>
                <span className="form__hint">{labels.app.change.replace("{before}", describe(change.before)).replace("{after}", describe(change.after))}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

/** A setting value in one line for the history list. */
function describe(value: unknown): string {
  if (value && typeof value === "object" && "value" in value) return String((value as { value: unknown }).value);
  if (value && typeof value === "object" && "xp" in value) {
    const game = value as Gamification;
    return `${Object.values(game.xp).join(", ")}; ${game.badges.streak_days}, ${game.badges.answers_in_subject}`;
  }
  return value === null || value === undefined ? "" : JSON.stringify(value);
}
