"use client";

import { useActionState, type ReactNode } from "react";
import { SUPPORT_PATH } from "@/constants";
import { formatDateTime } from "@/features/canon/components/format";
import { formatPoints } from "@/features/exams/domain/exam";
import { useI18n } from "@/features/localization/i18n-provider";
import { ReviewShell } from "@/features/review/components/review-shell";
import { addSupportNoteAction, addTeacherNoteAction } from "../actions";
import { share } from "../domain/indicators";
import type { NoteKind, ProfileSubject, StudentProfile, SupportActionResult, TeacherNote } from "../types";
import { ReadinessBadge } from "./readiness-badge";

const KINDS: NoteKind[] = ["student_talk", "parent_talk", "agreement", "observation"];

/**
 * Profil učenika (Sprint 09, SUPPORT_MONITORING.md B): the five dimensions per subject, areas, persistent errors (D4),
 * activity, mock exam trend against the student's own results, IDSS readiness (PDL-032), and support notes for the
 * pedagogue and the psychologist (D1 to D3). Opening this page is recorded in the access audit.
 */
export function StudentProfileScreen({ profile, teacherNotes }: { profile: StudentProfile; teacherNotes: TeacherNote[] | null }): ReactNode {
  const { dictionary, locale } = useI18n();
  const labels = dictionary.support;
  const activeDays = new Map(profile.days.map((day) => [day.day, day.answers]));
  const calendar = Array.from({ length: 60 }, (_, index) => {
    const date = new Date(`${profile.today}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() - (59 - index));
    const key = date.toISOString().slice(0, 10);
    return { key, answers: activeDays.get(key) ?? 0 };
  });

  return (
    <ReviewShell backHref={SUPPORT_PATH} backLabel={labels.backToOverview} title={profile.name} subtitle={labels.profile.subtitle}>
      <section className="card">
        <dl className="canon-version__meta">
          <div><dt>{labels.columns.lastActivity}</dt><dd>{profile.lastActivity ? formatDateTime(profile.lastActivity, locale) : labels.never}</dd></div>
          <div><dt>{labels.profile.practiceDays}</dt><dd>{profile.days.length}</dd></div>
          {profile.missions30 !== null && <div><dt>{labels.profile.missions}</dt><dd>{profile.missions30}</dd></div>}
        </dl>
        <h2>{labels.profile.calendar}</h2>
        <div className="activity-calendar" role="img" aria-label={labels.profile.calendarHint}>
          {calendar.map((day) => (
            <span key={day.key} className="activity-day" data-level={day.answers === 0 ? 0 : day.answers < 5 ? 1 : 2} title={`${day.key}: ${day.answers}`} />
          ))}
        </div>
        <p className="form__hint">{labels.profile.calendarHint}</p>
        <div className="link-row no-print">
          <button type="button" className="button-secondary" onClick={() => window.print()}>{labels.print}</button>
        </div>
      </section>

      {profile.subjects.map((subject) => (
        <SubjectSection key={subject.code} subject={subject}>
          {teacherNotes && <TeacherNotes personId={profile.personId} subject={subject.code} notes={teacherNotes.filter((note) => note.subject === subject.code)} />}
        </SubjectSection>
      ))}

      {profile.canWriteNotes && <Notes profile={profile} />}
      <p className="form__hint">{labels.readiness.label}</p>
    </ReviewShell>
  );
}

function SubjectSection({ subject, children }: { subject: ProfileSubject; children?: ReactNode }): ReactNode {
  const { dictionary, locale } = useI18n();
  const labels = dictionary.support;
  const percent = (part: number, whole: number) => {
    const value = share(part, whole);
    return value === null ? labels.cell.noData : `${value} %`;
  };
  const weakest = subject.areas.filter((area) => area.answered > 0).sort((a, b) => a.correct / a.answered - b.correct / b.answered);
  const graded = subject.exams.filter((exam) => exam.status === "graded" && exam.points !== null);

  return (
    <section className="card" aria-labelledby={`profile-${subject.code}`}>
      <h2 id={`profile-${subject.code}`}>{dictionary.subjects[subject.code]}</h2>
      <p>{labels.readiness.short} <ReadinessBadge readiness={subject.readiness} /></p>
      <div className="hub-stats support-dimensions">
        <div><strong>{labels.dimensions.completion}</strong><p>{labels.dimensions.completionValue.replace("{a}", String(subject.answered)).replace("{t}", String(subject.total))}</p></div>
        <div><strong>{labels.dimensions.accuracy}</strong><p>{labels.dimensions.accuracyValue.replace("{p30}", percent(subject.correct30, subject.checked30)).replace("{p}", percent(subject.correct, subject.checked))}</p></div>
        <div><strong>{labels.dimensions.mastery}</strong><p>{labels.dimensions.masteryValue.replace("{m}", String(subject.mastered)).replace("{t}", String(subject.total))}</p></div>
        <div><strong>{labels.dimensions.exams}</strong><p>{graded.length === 0 ? labels.cell.noExam : graded.map((exam) => formatPoints(exam.points ?? 0, locale)).join(", ") + ` / ${formatPoints(graded[0].max, locale)}`}</p></div>
      </div>

      <details open={weakest.length > 0}>
        <summary>{labels.profile.areas}</summary>
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>{labels.profile.area}</th><th>{labels.profile.answered}</th><th>{labels.profile.correctShare}</th></tr></thead>
            <tbody>
              {(weakest.length > 0 ? weakest : subject.areas).map((area) => (
                <tr key={`${area.ordinal}-${area.area}`}>
                  <td>{area.area}</td>
                  <td>{area.answered} / {area.total}</td>
                  <td>{percent(area.correct, area.answered)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="form__hint">{labels.profile.areasHint}</p>
      </details>

      <h3 className="support-subhead">{labels.profile.persistent}</h3>
      {subject.persistentErrors.length === 0 ? (
        <p>{labels.profile.noPersistent}</p>
      ) : (
        <ul>
          {subject.persistentErrors.map((error) => (
            <li key={error.questionVersionId}>{labels.profile.persistentItem.replace("{key}", error.recordKey).replace("{n}", String(error.wrong)).replace("{date}", formatDateTime(error.lastAt, locale))}</li>
          ))}
        </ul>
      )}
      <p className="form__hint">{labels.profile.persistentHint}</p>

      <h3 className="support-subhead">{labels.profile.exams}</h3>
      {subject.exams.length === 0 ? (
        <p>{labels.cell.noExam}</p>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>{labels.profile.examDate}</th><th>{labels.profile.examPoints}</th><th>{labels.profile.examTime}</th><th>{labels.profile.examEmpty}</th></tr></thead>
            <tbody>
              {subject.exams.map((exam, index) => {
                const previous = subject.exams.slice(0, index).reverse().find((entry) => entry.points !== null);
                const change = exam.points !== null && previous?.points != null ? exam.points - previous.points : null;
                return (
                  <tr key={exam.id}>
                    <td>{exam.submittedAt ? formatDateTime(exam.submittedAt, locale) : ""}</td>
                    <td>
                      {exam.points === null ? labels.profile.awaitingGrade : `${formatPoints(exam.points, locale)} / ${formatPoints(exam.max, locale)}`}
                      {change !== null && change !== 0 && ` (${change > 0 ? "+" : ""}${formatPoints(change, locale)})`}
                    </td>
                    <td>{exam.minutesUsed !== null && exam.minutes !== null ? `${exam.minutesUsed} / ${exam.minutes} min` : ""}{exam.auto ? `, ${labels.profile.auto}` : ""}</td>
                    <td>{exam.emptyUnits} / {exam.units}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {children}
    </section>
  );
}

/** Academic teacher notes of one subject (PDL-034): append-only, never shown to the student, kept out of print. */
function TeacherNotes({ personId, subject, notes }: { personId: string; subject: ProfileSubject["code"]; notes: TeacherNote[] }): ReactNode {
  const { dictionary, locale } = useI18n();
  const labels = dictionary.support.teacherNotes;
  const [result, formAction, pending] = useActionState<SupportActionResult | null, FormData>(addTeacherNoteAction, null);

  return (
    <div className="no-print">
      <h3 className="support-subhead">{labels.title}</h3>
      <p className="form__hint">{labels.hint}</p>
      <form key={notes.length} action={formAction} className="form">
        <input type="hidden" name="personId" value={personId} />
        <input type="hidden" name="subject" value={subject} />
        <div className="form__field">
          <label htmlFor={`teacher-note-${subject}`}>{labels.body}</label>
          <textarea id={`teacher-note-${subject}`} name="body" required maxLength={4000} rows={3} />
        </div>
        <div className="form__actions">
          <button type="submit" className="button-secondary" disabled={pending}>{labels.submit}</button>
          <p className="action-feedback" aria-live="polite">
            {result?.success && <span className="action-feedback--ok">{labels.saved}</span>}
            {result && !result.success && <span className="action-feedback--error">{dictionary.support.errors[result.code]}</span>}
          </p>
        </div>
      </form>
      {notes.length === 0 ? (
        <p>{labels.none}</p>
      ) : (
        <ul className="canon-history__list">
          {notes.map((note) => (
            <li key={note.id}>
              <span className="canon-history__event">{formatDateTime(note.createdAt, locale)}</span>
              <span>{note.body}</span>
              <span className="form__hint">{note.author}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Notes({ profile }: { profile: StudentProfile }): ReactNode {
  const { dictionary, locale } = useI18n();
  const labels = dictionary.support.notes;
  const [result, formAction, pending] = useActionState<SupportActionResult | null, FormData>(addSupportNoteAction, null);

  return (
    <section className="card support-notes no-print" aria-labelledby="support-notes-title">
      <h2 id="support-notes-title">{labels.title}</h2>
      <p className="notice">{labels.hint}</p>
      <form key={profile.notes.length} action={formAction} className="form no-print">
        <input type="hidden" name="personId" value={profile.personId} />
        <div className="form--grid form">
          <div className="form__field">
            <label htmlFor="note-kind">{labels.kind}</label>
            <select id="note-kind" name="kind" defaultValue="">
              <option value="">{labels.noKind}</option>
              {KINDS.map((kind) => <option key={kind} value={kind}>{labels.kinds[kind]}</option>)}
            </select>
          </div>
          <div className="form__field">
            <label htmlFor="note-follow-up">{labels.followUp}</label>
            <input id="note-follow-up" name="followUpOn" type="date" />
          </div>
          <div className="form__field">
            <label htmlFor="note-visibility">{labels.visibility}</label>
            <select id="note-visibility" name="visibility" defaultValue={profile.defaultVisibility}>
              <option value="author">{labels.visibilities.author}</option>
              <option value="support">{labels.visibilities.support}</option>
            </select>
          </div>
        </div>
        <div className="form__field">
          <label htmlFor="note-body">{labels.body}</label>
          <textarea id="note-body" name="body" required maxLength={4000} rows={4} />
        </div>
        <div className="form__actions">
          <button type="submit" className="button-primary" disabled={pending}>{labels.submit}</button>
          <p className="action-feedback" aria-live="polite">
            {result?.success && <span className="action-feedback--ok">{labels.saved}</span>}
            {result && !result.success && <span className="action-feedback--error">{dictionary.support.errors[result.code]}</span>}
          </p>
        </div>
      </form>
      {profile.notes.length === 0 ? (
        <p>{labels.none}</p>
      ) : (
        <ul className="canon-history__list">
          {profile.notes.map((note) => (
            <li key={note.id}>
              <span className="canon-history__event">{formatDateTime(note.createdAt, locale)}{note.kind ? `, ${labels.kinds[note.kind]}` : ""}</span>
              <span>{note.body}</span>
              <span className="form__hint">
                {labels.byLine.replace("{name}", note.author).replace("{visibility}", labels.visibilities[note.visibility])}
                {note.followUpOn ? `, ${labels.followUpOn.replace("{date}", note.followUpOn)}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
