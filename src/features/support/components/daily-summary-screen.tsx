"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { GRADING_PATH, SUPPORT_PATH } from "@/constants";
import { formatDateTime } from "@/features/canon/components/format";
import { useI18n } from "@/features/localization/i18n-provider";
import { ReviewShell } from "@/features/review/components/review-shell";
import { daysSince, previousDay, share } from "../domain/indicators";
import type { DailySubject, DailySummary } from "../types";

/**
 * Dnevni sažetak (PDL-018 item 3, Sprint 09): for one day and every subject the reader may see, who practised (answers,
 * accuracy), who did not and when each last practised, the areas of that day from the lowest accuracy, and open work.
 * No threshold marks a student inactive (P-4); the reader draws the conclusion.
 */
export function DailySummaryScreen({ summary, canGrade, canExport }: { summary: DailySummary; canGrade: boolean; canExport: boolean }): ReactNode {
  const { dictionary } = useI18n();
  const labels = dictionary.support.daily;
  const minDay = (() => {
    let day = summary.today;
    for (let index = 0; index < 30; index += 1) day = previousDay(day);
    return day;
  })();

  return (
    <ReviewShell backHref={SUPPORT_PATH} backLabel={dictionary.support.backToOverview} title={labels.title} subtitle={labels.subtitle.replace("{day}", summary.day)} print={{ confidential: true, exportHref: canExport ? `${SUPPORT_PATH}/dan/izvoz?d=${summary.day}` : undefined }}>
      <p className="notice">{labels.hint}</p>
      <section className="card no-print">
        <form method="get" className="support-filters">
          <div className="form__field">
            <label htmlFor="daily-day">{labels.day}</label>
            <input id="daily-day" type="date" name="d" defaultValue={summary.day} min={minDay} max={summary.today} required />
          </div>
          <div className="link-row">
            <button type="submit" className="button-primary">{labels.show}</button>
            <Link className="button-secondary" href={`${SUPPORT_PATH}/dan?d=${summary.today}`}>{labels.today}</Link>
          </div>
        </form>
      </section>
      {summary.subjects.map((subject) => <SubjectDay key={subject.code} subject={subject} day={summary.day} canGrade={canGrade} />)}
    </ReviewShell>
  );
}

function SubjectDay({ subject, day, canGrade }: { subject: DailySubject; day: string; canGrade: boolean }): ReactNode {
  const { dictionary, locale } = useI18n();
  const labels = dictionary.support.daily;
  const percent = (part: number, whole: number) => {
    const value = share(part, whole);
    return value === null ? dictionary.support.cell.noData : `${value} %`;
  };
  const areas = subject.areas.filter((area) => area.checked > 0);

  return (
    <section className="card daily-subject" aria-labelledby={`daily-${subject.code}`}>
      <h2 id={`daily-${subject.code}`}>{dictionary.subjects[subject.code]}</h2>
      <dl className="canon-version__meta">
        <div><dt>{labels.practisedCount}</dt><dd>{subject.practised.length}</dd></div>
        <div><dt>{labels.notPractisedCount}</dt><dd>{subject.notPractised.length}</dd></div>
        <div><dt>{labels.examsSubmitted}</dt><dd>{subject.examsSubmitted}</dd></div>
        <div><dt>{labels.waiting}</dt><dd>{labels.waitingValue.replace("{a}", String(subject.waitingAnswers)).replace("{e}", String(subject.waitingExams))}</dd></div>
      </dl>
      {canGrade && subject.waitingAnswers + subject.waitingExams > 0 && (
        <div className="link-row no-print"><Link className="button-secondary" href={GRADING_PATH}>{labels.toGrading}</Link></div>
      )}

      <h3>{labels.practised}</h3>
      {subject.practised.length === 0 ? <p>{labels.nobody}</p> : (
        <div className="table-scroll" tabIndex={0} role="region" aria-label={dictionary.common.table}>
          <table className="data-table">
            <thead><tr><th>{dictionary.support.columns.student}</th><th>{labels.answers}</th><th>{labels.accuracy}</th></tr></thead>
            <tbody>
              {subject.practised.map((row) => (
                <tr key={row.personId}>
                  <td><Link href={`${SUPPORT_PATH}/${row.personId}`}>{row.name}</Link></td>
                  <td>{row.answers}</td>
                  <td>{percent(row.correct, row.checked)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3>{labels.notPractised}</h3>
      {subject.notPractised.length === 0 ? <p>{labels.everybody}</p> : (
        <div className="table-scroll" tabIndex={0} role="region" aria-label={dictionary.common.table}>
          <table className="data-table">
            <thead><tr><th>{dictionary.support.columns.student}</th><th>{labels.lastPractice}</th><th>{labels.daysWithout}</th></tr></thead>
            <tbody>
              {subject.notPractised.map((row) => (
                <tr key={row.personId}>
                  <td><Link href={`${SUPPORT_PATH}/${row.personId}`}>{row.name}</Link></td>
                  <td>{row.lastPractice ? formatDateTime(row.lastPractice, locale) : dictionary.support.never}</td>
                  <td>{row.lastPractice ? String(daysSince(row.lastPractice, day) ?? "") : dictionary.support.cell.noData}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3>{labels.areas}</h3>
      {areas.length === 0 ? <p>{dictionary.support.analysis.empty}</p> : (
        <div className="table-scroll" tabIndex={0} role="region" aria-label={dictionary.common.table}>
          <table className="data-table">
            <thead><tr><th>{dictionary.support.analysis.area}</th><th>{dictionary.support.analysis.checked}</th><th>{dictionary.support.analysis.correctShare}</th></tr></thead>
            <tbody>
              {areas.map((area) => (
                <tr key={`${area.ordinal}-${area.area}`}><td>{area.area}</td><td>{area.checked}</td><td>{percent(area.correct, area.checked)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="form__hint">{labels.areasHint}</p>
    </section>
  );
}
