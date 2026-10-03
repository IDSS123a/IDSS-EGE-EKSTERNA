"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { EXAM_PATH, OWN_ACCOUNT_PATH, PRACTICE_PATH, SUBJECT_PATH } from "@/constants";
import { logoutAction } from "@/features/authentication/actions";
import type { SubjectCode } from "@/features/knowledge/types";
import { useI18n } from "@/features/localization/i18n-provider";
import { NotificationsPanel } from "@/features/notifications/components/notifications-panel";
import type { AppNotification } from "@/features/notifications/types";
import { SiteHeader } from "@/features/shell/components/site-header";
import { missionProgress, percent, streakDays, sumProgress } from "../domain/progress";
import type { PracticeOverview } from "../types";

/** Order of the three exam subjects on the Game Hub (Pravilnik Art. 5). */
const SUBJECT_ORDER: SubjectCode[] = ["bhs_language_literature", "mathematics", "german"];

/**
 * Student home (Game Hub, Sprint 06): streak, daily mission and the three subjects with mastery. Everything shown is a
 * learning signal (P-7); grades come from the teacher. Receives only the student's own counts, decided on the server.
 */
export function GameHub({ displayName, overview, dailyGoal, notifications }: { displayName: string; overview: PracticeOverview; dailyGoal: number; notifications: AppNotification[] }): ReactNode {
  const { dictionary } = useI18n();
  const labels = dictionary.hub;
  const streak = streakDays(overview.days, overview.todayDate);
  const mission = missionProgress(overview.today, dailyGoal);
  const subjects = SUBJECT_ORDER.map((code) => {
    const areas = overview.areas.filter((area) => area.subjectCode === code);
    return { code, subjectId: areas[0]?.subjectId ?? null, ...sumProgress(areas) };
  });

  return (
    <div className="page">
      <SiteHeader
        actions={
          <>
            <Link href={OWN_ACCOUNT_PATH} className="button-secondary">{dictionary.ownAccount.navLink}</Link>
            <form action={logoutAction}>
              <button type="submit" className="button-secondary">{dictionary.account.logout}</button>
            </form>
          </>
        }
      />
      <main className="page__main">
        <p className="home__eyebrow">{labels.eyebrow}</p>
        <h1 className="home__title">{labels.greeting.replace("{name}", displayName)}</h1>

        <NotificationsPanel notifications={notifications} />

        <div className="hub-stats">
          <section className="card hub-stat" aria-labelledby="hub-streak">
            <h2 id="hub-streak">{labels.streak}</h2>
            <p className="hub-stat__value">{streak > 0 ? labels.streakDays.replace("{n}", String(streak)) : labels.streakNone}</p>
          </section>
          <section className="card hub-stat" aria-labelledby="hub-mission">
            <h2 id="hub-mission">{labels.mission}</h2>
            <p>{labels.missionText.replace("{goal}", String(mission.goal))}</p>
            <progress className="hub-progress" max={mission.goal} value={mission.done} aria-label={`${mission.done} / ${mission.goal}`} />
            <p className="hub-stat__value">{mission.complete ? labels.missionDone : `${mission.done} / ${mission.goal}`}</p>
          </section>
        </div>

        <section className="card hub-exam" aria-labelledby="hub-exam">
          <h2 id="hub-exam">{labels.examTitle}</h2>
          <p>{labels.examText}</p>
          <div className="link-row">
            <Link href={EXAM_PATH} className="button-primary">{labels.examLink}</Link>
          </div>
        </section>

        <h2 className="hub-section-title">{labels.subjectsTitle}</h2>
        <div className="hub-subjects">
          {subjects.map((subject) => (
            <section key={subject.code} className="card hub-subject" aria-labelledby={`hub-${subject.code}`}>
              <h3 id={`hub-${subject.code}`}>{dictionary.subjects[subject.code]}</h3>
              {subject.total === 0 || !subject.subjectId ? (
                <p>{labels.noQuestions}</p>
              ) : (
                <>
                  <p>
                    {labels.mastered}: <strong>{percent(subject.correct, subject.total)} %</strong> ({subject.correct} / {subject.total})
                  </p>
                  <progress className="hub-progress" max={subject.total} value={subject.correct} aria-label={labels.masteredHint} />
                  {subject.awaiting > 0 && <p className="form__hint">{labels.awaiting.replace("{n}", String(subject.awaiting))}</p>}
                  <div className="link-row">
                    <Link href={`${PRACTICE_PATH}?predmet=${subject.code}`} className="button-primary">{labels.practise}</Link>
                    <Link href={`${SUBJECT_PATH}/${subject.code}`} className="button-secondary">{labels.areas}</Link>
                  </div>
                </>
              )}
            </section>
          ))}
        </div>
        <p className="form__hint">{labels.gameNote}</p>
      </main>
    </div>
  );
}
