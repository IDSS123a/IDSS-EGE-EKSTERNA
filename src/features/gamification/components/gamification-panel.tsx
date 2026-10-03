"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/features/localization/i18n-provider";
import { xpTotal } from "../domain/xp";
import type { GamificationOverview } from "../types";

/**
 * XP and badges on the Game Hub (Sprint 08, PDL-029). Presented as motivation, never as a grade (P-7, mandate 8.3):
 * the panel says so, and nothing here is shown beside points or results.
 */
export function GamificationPanel({ overview, streakDays, answersInSubject }: { overview: GamificationOverview; streakDays: number; answersInSubject: number }): ReactNode {
  const { dictionary } = useI18n();
  const labels = dictionary.gamification;
  const { xp, badges } = overview;
  const subjects = (codes: readonly string[]) => codes.map((code) => dictionary.subjects[code as keyof typeof dictionary.subjects]).join(", ");
  const list: { key: string; earned: boolean; title: string; text: string }[] = [
    { key: "first", earned: badges.firstAnswer, title: labels.badges.firstAnswer, text: labels.badges.firstAnswerHint },
    { key: "streak", earned: badges.streak, title: labels.badges.streak.replace("{n}", String(streakDays)), text: labels.badges.streakHint.replace("{n}", String(streakDays)) },
    {
      key: "answers",
      earned: badges.answersInSubject.length > 0,
      title: labels.badges.answers.replace("{n}", String(answersInSubject)),
      text: badges.answersInSubject.length > 0 ? subjects(badges.answersInSubject) : labels.badges.answersHint.replace("{n}", String(answersInSubject)),
    },
    {
      key: "exam",
      earned: badges.firstMockExam.length > 0,
      title: labels.badges.firstExam,
      text: badges.firstMockExam.length > 0 ? subjects(badges.firstMockExam) : labels.badges.firstExamHint,
    },
    { key: "all", earned: badges.allSubjects, title: labels.badges.allSubjects, text: labels.badges.allSubjectsHint },
  ];

  return (
    <section className="card" aria-labelledby="hub-xp">
      <h2 id="hub-xp">{labels.title}</h2>
      <p className="hub-stat__value">{labels.total.replace("{n}", String(xpTotal(xp)))}</p>
      <details>
        <summary>{labels.breakdown}</summary>
        <ul>
          <li>{labels.sources.answers.replace("{n}", String(xp.answers))}</li>
          <li>{labels.sources.missions.replace("{n}", String(xp.missions))}</li>
          <li>{labels.sources.practiceDays.replace("{n}", String(xp.practiceDays))}</li>
          <li>{labels.sources.examsSubmitted.replace("{n}", String(xp.examsSubmitted))}</li>
          <li>{labels.sources.examsGraded.replace("{n}", String(xp.examsGraded))}</li>
        </ul>
      </details>
      <h3>{labels.badgesTitle}</h3>
      <ul className="badge-list">
        {list.map((badge) => (
          <li key={badge.key} className="badge" data-earned={badge.earned ? "true" : "false"}>
            <strong>{badge.title}</strong>
            <span>{badge.earned ? labels.earned : labels.notYet}</span>
            <span className="form__hint">{badge.text}</span>
          </li>
        ))}
      </ul>
      <p className="form__hint">{labels.note}</p>
    </section>
  );
}
