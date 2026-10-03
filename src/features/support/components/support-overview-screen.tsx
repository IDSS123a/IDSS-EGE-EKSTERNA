"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { APP_HOME_PATH, SUPPORT_PATH } from "@/constants";
import { formatDateTime } from "@/features/canon/components/format";
import type { SubjectCode } from "@/features/knowledge/types";
import { formatPoints } from "@/features/exams/domain/exam";
import { useI18n } from "@/features/localization/i18n-provider";
import { ReviewShell } from "@/features/review/components/review-shell";
import { daysSince, droppedAgainstOwnPrevious, share, withoutPracticeFor } from "../domain/indicators";
import type { FollowUp, OverviewStudent } from "../types";
import { ReadinessBadge } from "./readiness-badge";

type SortKey = "name" | "lastActivity" | "days30" | "mastered" | "accuracy";

/**
 * Praćenje učenika (Sprint 09, SUPPORT_MONITORING.md A): every student with facts per subject. Filters are set by the
 * user (subject, N days without practice, a drop against the student's own previous mock exam); the app sets no
 * threshold and gives no label (P-4, mandate §11).
 */
export function SupportOverviewScreen({ students, codes, today, followUps, canExport }: { students: OverviewStudent[]; codes: SubjectCode[]; today: string; followUps: FollowUp[] | null; canExport: boolean }): ReactNode {
  const { dictionary, locale } = useI18n();
  const labels = dictionary.support;
  const [subject, setSubject] = useState<SubjectCode | "all">("all");
  const [inactiveDays, setInactiveDays] = useState("");
  const [dropOnly, setDropOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("name");

  const rows = useMemo(() => {
    const days = Number(inactiveDays);
    const pick = (student: OverviewStudent) => student.subjects.filter((entry) => subject === "all" || entry.code === subject);
    const sum = (student: OverviewStudent, key: "mastered" | "total" | "correct30" | "checked30") => pick(student).reduce((total, entry) => total + entry[key], 0);
    const value = (student: OverviewStudent): number | string => {
      switch (sort) {
        case "lastActivity": return -(daysSince(student.lastActivity, today) ?? 99999);
        case "days30": return student.days30;
        case "mastered": return share(sum(student, "mastered"), sum(student, "total")) ?? -1;
        case "accuracy": return share(sum(student, "correct30"), sum(student, "checked30")) ?? -1;
        default: return student.name;
      }
    };
    return students
      .filter((student) => (inactiveDays.trim() === "" || !Number.isFinite(days) ? true : withoutPracticeFor(student, days, today)))
      .filter((student) => !dropOnly || droppedAgainstOwnPrevious(student))
      .map((student) => ({ student, subjects: pick(student), key: value(student) }))
      .sort((a, b) => (typeof a.key === "string" && typeof b.key === "string" ? a.key.localeCompare(b.key, locale) : Number(a.key) - Number(b.key)));
  }, [students, subject, inactiveDays, dropOnly, sort, today, locale]);

  return (
    <ReviewShell backHref={APP_HOME_PATH} backLabel={labels.back} title={labels.title} subtitle={labels.subtitle}>
      <p className="notice">{labels.principle}</p>
      {followUps && followUps.length > 0 && (
        <section className="card" aria-labelledby="support-follow-ups">
          <h2 id="support-follow-ups">{labels.followUps}</h2>
          <ul className="review-list">
            {followUps.map((item, index) => (
              <li key={`${item.personId}-${index}`}>
                <Link href={`${SUPPORT_PATH}/${item.personId}`} className="review-list__item review-list__item--compact">
                  <strong className="review-list__key">{item.student}</strong>
                  <span>{item.kind ? labels.notes.kinds[item.kind] : ""}</span>
                  <span>{item.followUpOn}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card support-filters no-print" aria-label={labels.filters.title}>
        {codes.length > 1 && (
          <div className="form__field">
            <label htmlFor="support-subject">{labels.filters.subject}</label>
            <select id="support-subject" value={subject} onChange={(event) => setSubject(event.target.value as SubjectCode | "all")}>
              <option value="all">{labels.filters.allSubjects}</option>
              {codes.map((code) => <option key={code} value={code}>{dictionary.subjects[code]}</option>)}
            </select>
          </div>
        )}
        <div className="form__field">
          <label htmlFor="support-inactive">{labels.filters.inactive}</label>
          <input id="support-inactive" type="number" min={1} max={365} inputMode="numeric" value={inactiveDays} onChange={(event) => setInactiveDays(event.target.value)} placeholder={labels.filters.inactivePlaceholder} />
        </div>
        <label className="practice-choice">
          <input type="checkbox" checked={dropOnly} onChange={(event) => setDropOnly(event.target.checked)} />
          <span>{labels.filters.drop}</span>
        </label>
        <div className="form__field">
          <label htmlFor="support-sort">{labels.filters.sort}</label>
          <select id="support-sort" value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
            {(["name", "lastActivity", "days30", "mastered", "accuracy"] as const).map((key) => <option key={key} value={key}>{labels.sort[key]}</option>)}
          </select>
        </div>
        <div className="link-row">
          <button type="button" className="button-secondary" onClick={() => window.print()}>{labels.print}</button>
          {canExport && <a className="button-secondary" href={`${SUPPORT_PATH}/izvoz`}>{labels.export}</a>}
          <Link className="button-secondary" href={`${SUPPORT_PATH}/analiza`}>{labels.analysisLink}</Link>
          <Link className="button-secondary" href={`${SUPPORT_PATH}/dan`}>{labels.dailyLink}</Link>
        </div>
      </section>

      <section className="card" aria-labelledby="support-table">
        <h2 id="support-table">{labels.students.replace("{n}", String(rows.length))}</h2>
        {rows.length === 0 ? (
          <p>{labels.empty}</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{labels.columns.student}</th>
                  <th>{labels.columns.lastActivity}</th>
                  <th>{labels.columns.days}</th>
                  {(subject === "all" ? codes : [subject]).map((code) => <th key={code}>{dictionary.subjects[code]}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map(({ student, subjects }) => (
                  <tr key={student.personId}>
                    <td><Link href={`${SUPPORT_PATH}/${student.personId}`}>{student.name}</Link></td>
                    <td>{student.lastActivity ? formatDateTime(student.lastActivity, locale) : labels.never}</td>
                    <td>{labels.daysValue.replace("{d7}", String(student.days7)).replace("{d30}", String(student.days30))}</td>
                    {subjects.map((entry) => {
                      const accuracy = share(entry.correct30, entry.checked30);
                      const latest = entry.exams[0];
                      return (
                        <td key={entry.code}>
                          <span className="support-cell">{labels.cell.mastered.replace("{m}", String(entry.mastered)).replace("{t}", String(entry.total))}</span>
                          <span className="support-cell">{accuracy === null ? labels.cell.noAccuracy : labels.cell.accuracy.replace("{p}", String(accuracy))}</span>
                          <span className="support-cell">{latest ? labels.cell.exam.replace("{p}", formatPoints(latest.points, locale)).replace("{max}", formatPoints(latest.max, locale)) : labels.cell.noExam}</span>
                          {entry.open > 0 && <span className="support-cell">{labels.cell.open.replace("{n}", String(entry.open))}</span>}
                          <span className="support-cell">{labels.readiness.short} <ReadinessBadge readiness={entry.readiness} /></span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="form__hint">{labels.readiness.label}</p>
      </section>
    </ReviewShell>
  );
}
