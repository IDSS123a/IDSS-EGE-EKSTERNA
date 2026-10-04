"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { APP_HOME_PATH, DIRECTOR_PATH, SUPPORT_PATH } from "@/constants";
import { formatDateTime } from "@/features/canon/components/format";
import { useI18n } from "@/features/localization/i18n-provider";
import { ReviewShell } from "@/features/review/components/review-shell";
import { DIRECTOR_TABS, percentOf, PERIOD_CHOICES } from "../domain/period";
import type { PushStatus } from "@/features/push/send";
import type { AuditFilter, AuditPage, ContentHealth, DirectorTab, Overview, PeriodChoice, SubjectAggregate, SystemHealth, TeacherActivity } from "../types";

export type DirectorData =
  | { tab: "pregled"; overview: Overview }
  | { tab: "predmeti"; subjects: SubjectAggregate[]; minGroup: number }
  | { tab: "nastavnici"; teachers: TeacherActivity[] }
  | { tab: "sadrzaj"; content: ContentHealth[]; minGroup: number }
  | { tab: "sistem"; system: SystemHealth; push: PushStatus }
  | { tab: "dnevnik"; audit: AuditPage; filter: AuditFilter; pageSize: number };

/**
 * Direktorski pregled (PDL-040, mandate §13): an institutional view, aggregates first, no surveillance. Figures built
 * from fewer students than the minimum group show "premalo učenika" (K2). Every tab prints in the IDSS format; the
 * teacher activity and the audit log also export as IDSS CSV.
 */
export function DirectorScreen({ data, period, hasSchoolYear, canAudit }: { data: DirectorData; period: PeriodChoice; hasSchoolYear: boolean; canAudit: boolean }): ReactNode {
  const { dictionary } = useI18n();
  const labels = dictionary.director;
  const href = (tab: DirectorTab, choice: PeriodChoice = period) => `${DIRECTOR_PATH}?tab=${tab}&period=${choice}`;
  const periodic = data.tab === "pregled" || data.tab === "predmeti" || data.tab === "nastavnici";
  const exportHref = data.tab === "nastavnici" ? `${DIRECTOR_PATH}/izvoz?tab=nastavnici&period=${period}`
    : data.tab === "dnevnik" ? `${DIRECTOR_PATH}/izvoz?tab=dnevnik&${auditQuery(data.filter)}` : undefined;

  return (
    <ReviewShell backHref={APP_HOME_PATH} backLabel={labels.back} title={labels.title} subtitle={periodic ? `${labels.tabs[data.tab]}, ${labels.periods[period]}` : labels.tabs[data.tab]}
      print={{ confidential: data.tab === "nastavnici" || data.tab === "dnevnik", exportHref }}>
      <nav className="director-tabs no-print" aria-label={labels.title}>
        {DIRECTOR_TABS.filter((tab) => tab !== "dnevnik" || canAudit).map((tab) => (
          <Link key={tab} href={href(tab)} className={tab === data.tab ? "button-primary" : "button-secondary"} aria-current={tab === data.tab ? "page" : undefined}>{labels.tabs[tab]}</Link>
        ))}
      </nav>
      {periodic && (
        <nav className="director-periods no-print" aria-label={labels.period}>
          <span>{labels.period}:</span>
          {PERIOD_CHOICES.filter((choice) => choice !== "godina" || hasSchoolYear).map((choice) => (
            <Link key={choice} href={href(data.tab, choice)} aria-current={choice === period ? "true" : undefined} className={choice === period ? "director-period director-period--active" : "director-period"}>{labels.periods[choice]}</Link>
          ))}
          {!hasSchoolYear && <span className="form__hint">{labels.noSchoolYear}</span>}
        </nav>
      )}
      <div className="link-row no-print">
        <Link className="button-secondary" href={`${SUPPORT_PATH}/dan`}>{labels.dailyLink}</Link>
        <Link className="button-secondary" href={SUPPORT_PATH}>{labels.supportLink}</Link>
      </div>
      {data.tab === "pregled" && <OverviewTab overview={data.overview} />}
      {data.tab === "predmeti" && <SubjectsTab subjects={data.subjects} minGroup={data.minGroup} />}
      {data.tab === "nastavnici" && <TeachersTab teachers={data.teachers} />}
      {data.tab === "sadrzaj" && <ContentTab content={data.content} minGroup={data.minGroup} />}
      {data.tab === "sistem" && <SystemTab system={data.system} push={data.push} />}
      {data.tab === "dnevnik" && <AuditTab audit={data.audit} filter={data.filter} pageSize={data.pageSize} />}
    </ReviewShell>
  );
}

function auditQuery(filter: AuditFilter): string {
  const parts = [["akcija", filter.action], ["osoba", filter.person], ["od", filter.from], ["do", filter.to]].filter(([, value]) => value) as [string, string][];
  return parts.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("&");
}

/** A figure or "premalo učenika" when it is hidden (K2). */
function Figure({ value, suffix = "" }: { value: number | null; suffix?: string }): ReactNode {
  const { dictionary } = useI18n();
  return value === null ? <span className="form__hint">{dictionary.director.tooFew}</span> : <>{value}{suffix}</>;
}

function Stat({ label, children }: { label: string; children: ReactNode }): ReactNode {
  return <div className="director-stat"><span className="form__hint">{label}</span><strong>{children}</strong></div>;
}

function OverviewTab({ overview }: { overview: Overview }): ReactNode {
  const { dictionary } = useI18n();
  const labels = dictionary.director.overview;
  const states = dictionary.assignments.states;
  return (
    <>
      <section className="card" aria-labelledby="director-participation">
        <h2 id="director-participation">{labels.participation}</h2>
        <div className="director-stats">
          <Stat label={labels.studentsActive}>{overview.studentsActive}</Stat>
          <Stat label={labels.studentsPractised}>{overview.studentsPractised}</Stat>
          <Stat label={labels.answers}><Figure value={overview.answers} /></Stat>
          <Stat label={labels.exams}>{overview.exams.requested} / {overview.exams.submitted} / {overview.exams.graded}</Stat>
          <Stat label={labels.assignments}>{overview.assignments.given}</Stat>
          <Stat label={labels.gifts}>{overview.gifts}</Stat>
        </div>
        <p className="form__hint">{labels.examsHint}</p>
      </section>
      <section className="card" aria-labelledby="director-weeks">
        <h2 id="director-weeks">{labels.weeks}</h2>
        {overview.weeks.length === 0 ? <p>{dictionary.director.empty}</p> : (
          <div className="table-scroll" tabIndex={0} role="region" aria-label={dictionary.common.table}>
            <table className="data-table">
              <thead><tr><th>{labels.week}</th><th>{labels.studentsPractised}</th><th>{labels.answers}</th></tr></thead>
              <tbody>{overview.weeks.map((week) => <tr key={week.week}><td>{week.week}</td><td>{week.students}</td><td><Figure value={week.answers} /></td></tr>)}</tbody>
            </table>
          </div>
        )}
      </section>
      <section className="card" aria-labelledby="director-assignments">
        <h2 id="director-assignments">{labels.assignmentStates}</h2>
        {overview.assignments.states === null ? <p className="form__hint">{dictionary.director.tooFew}</p> : Object.keys(overview.assignments.states).length === 0 ? <p>{dictionary.director.empty}</p> : (
          <ul>{Object.entries(overview.assignments.states).map(([state, count]) => <li key={state}>{states[state as keyof typeof states] ?? state}: {count}</li>)}</ul>
        )}
      </section>
      <p className="form__hint">{dictionary.director.minGroupNote.replace("{n}", String(overview.minGroup))}</p>
    </>
  );
}

function SubjectsTab({ subjects, minGroup }: { subjects: SubjectAggregate[]; minGroup: number }): ReactNode {
  const { dictionary } = useI18n();
  const labels = dictionary.director.subjects;
  const readiness = dictionary.support.readiness;
  const stateLabel = (state: string) => (state === "not_available" ? readiness.notAvailable : state === "below_80" ? readiness.below80 : `${state} %`);
  return (
    <>
      {subjects.map((subject) => (
        <section key={subject.code} className="card" aria-labelledby={`director-${subject.code}`}>
          <h2 id={`director-${subject.code}`}>{dictionary.subjects[subject.code]}</h2>
          <div className="director-stats">
            <Stat label={labels.trusted}>{subject.trusted}</Stat>
            <Stat label={labels.students}>{subject.students}</Stat>
            <Stat label={labels.coverage}><Figure value={percentOf(subject.covered, subject.trusted)} suffix=" %" /></Stat>
            <Stat label={labels.accuracy}><Figure value={percentOf(subject.correct, subject.checked)} suffix=" %" /></Stat>
            <Stat label={labels.gradedExams}>{subject.gradedExams}</Stat>
          </div>
          <h3 className="support-subhead">{labels.readiness}</h3>
          {subject.readiness === null ? <p className="form__hint">{dictionary.director.tooFew}</p> : (
            <ul>{Object.entries(subject.readiness).map(([state, count]) => <li key={state}>{stateLabel(state)}: {count}</li>)}</ul>
          )}
          <h3 className="support-subhead">{labels.examPoints}</h3>
          {subject.examPoints === null ? <p className="form__hint">{subject.gradedExams === 0 ? dictionary.director.empty : dictionary.director.tooFew}</p> : (
            <ul>{subject.examPoints.map((row) => <li key={row.points}>{labels.pointsRow.replace("{p}", String(row.points)).replace("{n}", String(row.exams))}</li>)}</ul>
          )}
        </section>
      ))}
      <p className="form__hint">{dictionary.director.minGroupNote.replace("{n}", String(minGroup))} {dictionary.support.readiness.label}</p>
    </>
  );
}

function TeachersTab({ teachers }: { teachers: TeacherActivity[] }): ReactNode {
  const { dictionary } = useI18n();
  const labels = dictionary.director.teachers;
  return (
    <section className="card" aria-labelledby="director-teachers">
      <h2 id="director-teachers">{labels.title}</h2>
      <p className="form__hint">{labels.hint}</p>
      {teachers.length === 0 ? <p>{dictionary.director.empty}</p> : (
        <div className="table-scroll" tabIndex={0} role="region" aria-label={dictionary.common.table}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{labels.name}</th><th>{labels.records}</th><th>{labels.answers}</th><th>{labels.exams}</th><th>{labels.assignments}</th><th>{labels.gifts}</th><th>{labels.notes}</th><th>{labels.waiting}</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((teacher) => (
                <tr key={teacher.name}>
                  <td><strong>{teacher.name}</strong><span className="form__hint support-cell">{teacher.subjects.map((code) => dictionary.subjects[code]).join(", ")}</span></td>
                  <td>{teacher.recordsReviewed + teacher.rulesReviewed}</td>
                  <td>{teacher.answersReviewed}</td>
                  <td>{teacher.setsApproved} / {teacher.examsGraded}</td>
                  <td>{teacher.assignmentsGiven}</td>
                  <td>{teacher.giftsGiven}</td>
                  <td>{teacher.notesWritten}</td>
                  <td>{labels.waitingValue.replace("{a}", String(teacher.waitingAnswers)).replace("{e}", String(teacher.waitingExams))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="form__hint">{labels.legend}</p>
    </section>
  );
}

function ContentTab({ content, minGroup }: { content: ContentHealth[]; minGroup: number }): ReactNode {
  const { dictionary, locale } = useI18n();
  const labels = dictionary.director.content;
  return (
    <>
      {content.map((subject) => (
        <section key={subject.code} className="card" aria-labelledby={`content-${subject.code}`}>
          <h2 id={`content-${subject.code}`}>{dictionary.subjects[subject.code]}</h2>
          <div className="director-stats">
            <Stat label={labels.accepted}>{subject.accepted} / {subject.records}</Stat>
            <Stat label={labels.returned}>{subject.returned}</Stat>
            <Stat label={labels.revisions}>{subject.textRevisions}</Stat>
            <Stat label={labels.errata}>{subject.errataOpen}</Stat>
            <Stat label={labels.followUps}>{subject.followUpsOpen}</Stat>
            <Stat label={labels.index}>{subject.embeddings} / {subject.chunks}</Stat>
          </div>
          <p>
            <strong>{labels.blueprint}:</strong>{" "}
            {!subject.blueprint ? labels.noBlueprint : subject.blueprint.review
              ? labels.blueprintReviewed.replace("{decision}", labels.decisions[subject.blueprint.review.decision as keyof typeof labels.decisions] ?? subject.blueprint.review.decision).replace("{by}", subject.blueprint.review.by).replace("{at}", formatDateTime(subject.blueprint.review.at, locale))
              : labels.blueprintWaiting.replace("{at}", formatDateTime(subject.blueprint.loadedAt, locale))}
          </p>
          <h3 className="support-subhead">{labels.missed}</h3>
          {subject.missed.length === 0 ? <p className="form__hint">{labels.noMissed.replace("{n}", String(minGroup))}</p> : (
            <ul>{subject.missed.map((miss) => <li key={miss.key}>{labels.missedRow.replace("{key}", miss.key).replace("{n}", String(miss.wrong)).replace("{s}", String(miss.students))}</li>)}</ul>
          )}
        </section>
      ))}
    </>
  );
}

function SystemTab({ system, push }: { system: SystemHealth; push: PushStatus }): ReactNode {
  const { dictionary, locale } = useI18n();
  const labels = dictionary.director.system;
  const notices030 = system.notificationKinds?.includes("gift_given") ?? false;
  return (
    <>
      <section className="card" aria-labelledby="system-waiting">
        <h2 id="system-waiting">{labels.waitingTitle}</h2>
        <ul>
          <li>{notices030 ? labels.m030done : labels.m030waiting}</li>
          <li>{push.state === "on" ? labels.pushOn : push.state === "off" ? labels.pushOff : labels.pushInvalid.replace("{field}", labels.pushFields[push.field])}</li>
        </ul>
      </section>
      <section className="card" aria-labelledby="system-security">
        <h2 id="system-security">{labels.security}</h2>
        {Object.keys(system.security).length === 0 ? <p>{labels.noSecurity}</p> : (
          <ul>{Object.entries(system.security).map(([kind, count]) => <li key={kind}>{labels.kinds[kind as keyof typeof labels.kinds] ?? kind}: {count}</li>)}</ul>
        )}
      </section>
      <section className="card" aria-labelledby="system-index">
        <h2 id="system-index">{labels.index}</h2>
        <p>{labels.indexValue.replace("{e}", String(system.embeddings)).replace("{c}", String(system.chunks)).replace("{at}", system.indexBuiltAt ? formatDateTime(system.indexBuiltAt, locale) : "")}</p>
        <h3 className="support-subhead">{labels.jobs}</h3>
        <ul>{system.jobs.map((job, index) => <li key={index}>{job.profile}: {labels.states[job.state as keyof typeof labels.states] ?? job.state}{job.finishedAt ? `, ${formatDateTime(job.finishedAt, locale)}` : ""}</li>)}</ul>
        <h3 className="support-subhead">{labels.migrations}</h3>
        <ul>{system.migrations.map((migration) => <li key={migration.version}>{migration.name}</li>)}</ul>
      </section>
    </>
  );
}

function AuditTab({ audit, filter, pageSize }: { audit: AuditPage; filter: AuditFilter; pageSize: number }): ReactNode {
  const { dictionary, locale } = useI18n();
  const labels = dictionary.director.audit;
  const pages = Math.max(1, Math.ceil(audit.total / pageSize));
  const pageHref = (page: number) => `${DIRECTOR_PATH}?tab=dnevnik&${auditQuery(filter)}&strana=${page}`;
  return (
    <section className="card" aria-labelledby="director-audit">
      <h2 id="director-audit">{labels.title.replace("{n}", String(audit.total))}</h2>
      <form method="get" className="support-filters no-print">
        <input type="hidden" name="tab" value="dnevnik" />
        <div className="form__field">
          <label htmlFor="audit-action">{labels.action}</label>
          <select id="audit-action" name="akcija" defaultValue={filter.action ?? ""}>
            <option value="">{labels.all}</option>
            {audit.actions.map((action) => <option key={action} value={action}>{action}</option>)}
          </select>
        </div>
        <div className="form__field">
          <label htmlFor="audit-person">{labels.person}</label>
          <select id="audit-person" name="osoba" defaultValue={filter.person ?? ""}>
            <option value="">{labels.all}</option>
            {audit.people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select>
        </div>
        <div className="form__field">
          <label htmlFor="audit-from">{labels.from}</label>
          <input id="audit-from" name="od" type="date" defaultValue={filter.from ?? ""} />
        </div>
        <div className="form__field">
          <label htmlFor="audit-to">{labels.to}</label>
          <input id="audit-to" name="do" type="date" defaultValue={filter.to ?? ""} />
        </div>
        <div className="link-row"><button type="submit" className="button-primary">{labels.apply}</button><Link className="button-secondary" href={`${DIRECTOR_PATH}?tab=dnevnik`}>{labels.reset}</Link></div>
      </form>
      {audit.rows.length === 0 ? <p>{dictionary.director.empty}</p> : (
        <div className="table-scroll" tabIndex={0} role="region" aria-label={dictionary.common.table}>
          <table className="data-table">
            <thead><tr><th>{labels.at}</th><th>{labels.action}</th><th>{labels.person}</th><th>{labels.entity}</th><th>{labels.details}</th></tr></thead>
            <tbody>
              {audit.rows.map((row) => (
                <tr key={row.id}>
                  <td>{formatDateTime(row.at, locale)}</td>
                  <td>{row.action}</td>
                  <td>{row.actor ?? ""}</td>
                  <td>{row.entityType}{row.entityId ? ` ${row.entityId}` : ""}</td>
                  <td className="director-details">{Object.keys(row.details).length > 0 ? JSON.stringify(row.details) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="link-row no-print">
        {filter.page > 1 && <Link className="button-secondary" href={pageHref(filter.page - 1)}>{labels.previous}</Link>}
        <span className="form__hint">{labels.page.replace("{p}", String(filter.page)).replace("{n}", String(pages))}</span>
        {filter.page < pages && <Link className="button-secondary" href={pageHref(filter.page + 1)}>{labels.next}</Link>}
      </div>
      <p className="form__hint">{labels.hint}</p>
    </section>
  );
}
