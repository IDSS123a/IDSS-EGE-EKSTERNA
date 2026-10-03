"use client";

import type { ReactNode } from "react";
import { SUPPORT_PATH } from "@/constants";
import type { SubjectCode } from "@/features/knowledge/types";
import { useI18n } from "@/features/localization/i18n-provider";
import { ReviewShell } from "@/features/review/components/review-shell";
import { share } from "../domain/indicators";
import type { GroupPatterns } from "../types";

/** Analiza grupe (Sprint 09, SUPPORT_MONITORING.md C): aggregates only, no student named, no ranking. */
export function GroupAnalysisScreen({ patterns, codes }: { patterns: GroupPatterns; codes: SubjectCode[] }): ReactNode {
  const { dictionary } = useI18n();
  const labels = dictionary.support.analysis;
  const percent = (part: number, whole: number) => {
    const value = share(part, whole);
    return value === null ? dictionary.support.cell.noData : `${value} %`;
  };

  return (
    <ReviewShell backHref={SUPPORT_PATH} backLabel={dictionary.support.backToOverview} title={labels.title} subtitle={labels.subtitle.replace("{n}", String(patterns.students))}>
      <p className="notice">{labels.hint}</p>

      <section className="card" aria-labelledby="analysis-weeks">
        <h2 id="analysis-weeks">{labels.weeks}</h2>
        {patterns.weeks.length === 0 ? <p>{labels.empty}</p> : (
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>{labels.week}</th><th>{labels.activeStudents}</th><th>{labels.answers}</th></tr></thead>
              <tbody>{patterns.weeks.map((week) => <tr key={week.week}><td>{week.week}</td><td>{week.students}</td><td>{week.answers}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </section>

      {codes.map((code) => {
        const areas = patterns.areas.filter((area) => area.subject === code && area.checked > 0).sort((a, b) => a.correct / a.checked - b.correct / b.checked);
        const points = patterns.examPoints.filter((row) => row.subject === code);
        const missed = patterns.missedQuestions.filter((row) => row.subject === code);
        return (
          <section key={code} className="card" aria-labelledby={`analysis-${code}`}>
            <h2 id={`analysis-${code}`}>{dictionary.subjects[code]}</h2>
            <h3>{labels.areas}</h3>
            {areas.length === 0 ? <p>{labels.empty}</p> : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead><tr><th>{labels.area}</th><th>{labels.checked}</th><th>{labels.correctShare}</th></tr></thead>
                  <tbody>{areas.map((area) => <tr key={`${area.ordinal}-${area.area}`}><td>{area.area}</td><td>{area.checked}</td><td>{percent(area.correct, area.checked)}</td></tr>)}</tbody>
                </table>
              </div>
            )}
            <h3>{labels.examPoints}</h3>
            {points.length === 0 ? <p>{labels.empty}</p> : (
              <ul>{points.map((row) => <li key={row.points}>{labels.pointsRow.replace("{p}", String(row.points)).replace("{n}", String(row.exams))}</li>)}</ul>
            )}
            <h3>{labels.missed}</h3>
            {missed.length === 0 ? <p>{labels.empty}</p> : (
              <ul>{missed.map((row) => <li key={row.recordKey}>{labels.missedRow.replace("{key}", row.recordKey).replace("{n}", String(row.wrong)).replace("{s}", String(row.students))}</li>)}</ul>
            )}
          </section>
        );
      })}
    </ReviewShell>
  );
}
