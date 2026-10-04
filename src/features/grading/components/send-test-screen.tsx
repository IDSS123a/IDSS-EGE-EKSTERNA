"use client";

import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";
import { GRADING_PATH } from "@/constants";
import { formatDateTime } from "@/features/canon/components/format";
import { formatPoints, testLabel } from "@/features/exams/domain/exam";
import type { ExamStatus } from "@/features/exams/types";
import { useI18n } from "@/features/localization/i18n-provider";
import { ReviewShell } from "@/features/review/components/review-shell";
import { sendTestAction } from "../actions";
import type { SendOptions, SendTestResult, SentTest } from "../types";

const STATES: ExamStatus[] = ["awaiting_approval", "approved", "in_progress", "submitted", "graded", "discarded"];

type Props = {
  options: SendOptions[];
  students: { personId: string; name: string }[];
  sent: SentTest[];
  /** From the student profile: subject code, student person id and weak area label to start from. */
  preset: { subject: string | null; student: string | null; area: string | null };
};

/**
 * Pošalji test (PDL-043): the teacher sends a whole test or chosen positions of the official test (T2) with an own
 * time limit for a part (T3) to all students of the subject or to chosen ones. Every set still waits for the teacher's
 * approval (T4); below, the sent tests with every student's set.
 */
export function SendTestScreen({ options, students, sent, preset }: Props): ReactNode {
  const { dictionary } = useI18n();
  const labels = dictionary.grading.send;

  return (
    <ReviewShell backHref={GRADING_PATH} backLabel={labels.back} title={labels.title} subtitle={labels.subtitle} print={{ confidential: false }}>
      <p className="notice">{labels.hint}</p>
      {options.length > 0 && <SendForm options={options} students={students} preset={preset} />}
      <SentList sent={sent} />
    </ReviewShell>
  );
}

function SendForm({ options, students, preset }: Omit<Props, "sent">): ReactNode {
  const { dictionary, locale } = useI18n();
  const labels = dictionary.grading.send;
  const formats = dictionary.grading.blueprints.formats;
  const [result, formAction, pending] = useActionState<SendTestResult | null, FormData>(sendTestAction, null);
  const initial = options.find((entry) => entry.subjectCode === preset.subject) ?? options[0];
  // Positions whose catalogue ranges cover the weak area. When every position covers it (Mathematics draws each
  // position from all areas), nothing is preselected: the teacher picks the positions.
  const covering = preset.area ? initial.positions.filter((position) => position.areas.some((area) => area.name === preset.area)).map((position) => position.position) : [];
  const presetPositions = covering.length < initial.positions.length ? covering : [];
  const [subjectId, setSubjectId] = useState(initial.subjectId);
  const [chosen, setChosen] = useState<number[]>(presetPositions);
  const [kind, setKind] = useState<"full" | "part">(covering.length > 0 ? "part" : "full");
  const [audience, setAudience] = useState<"all" | "chosen">(preset.student ? "chosen" : "all");
  const subject = options.find((entry) => entry.subjectId === subjectId) ?? initial;
  const chosenPoints = subject.positions.filter((position) => chosen.includes(position.position)).reduce((sum, position) => sum + position.points, 0);

  function changeSubject(id: string): void {
    setSubjectId(id);
    setChosen([]);
  }

  function toggle(position: number, on: boolean): void {
    setChosen((current) => (on ? [...current, position] : current.filter((entry) => entry !== position)));
  }

  return (
    <section className="card no-print" aria-labelledby="send-new">
      <h2 id="send-new">{labels.newTitle}</h2>
      <form key={result?.success ? `sent-${result.data.created}-${result.data.skipped.length}` : "new"} action={formAction} className="form">
        <div className="form--grid form">
          <div className="form__field">
            <label htmlFor="send-subject">{labels.subject}</label>
            <select id="send-subject" name="subjectId" value={subjectId} onChange={(event) => changeSubject(event.target.value)}>
              {options.map((entry) => <option key={entry.subjectId} value={entry.subjectId}>{dictionary.subjects[entry.subjectCode]}</option>)}
            </select>
          </div>
        </div>

        {!subject.available ? (
          <p className="form__hint">{labels.unavailable}</p>
        ) : (
          <>
            <fieldset className="form__field">
              <legend>{labels.kind}</legend>
              <div className="practice-choices">
                <label className="practice-choice"><input type="radio" name="kind" value="full" checked={kind === "full"} onChange={() => setKind("full")} /> <span>{labels.kindFull}</span></label>
                <label className="practice-choice"><input type="radio" name="kind" value="part" checked={kind === "part"} onChange={() => setKind("part")} /> <span>{labels.kindPart}</span></label>
              </div>
            </fieldset>

            {kind === "full" ? (
              subject.minutes !== null && subject.totalPoints !== null && (
                <p className="form__hint">{labels.fullMinutes.replace("{n}", String(subject.minutes)).replace("{points}", formatPoints(subject.totalPoints, locale))}</p>
              )
            ) : (
              <>
                <fieldset className="form__field assignment-students">
                  <legend>{labels.positions}</legend>
                  {subject.positions.map((position) => (
                    <label key={position.position} className="practice-choice">
                      <input type="checkbox" name="position" value={position.position} checked={chosen.includes(position.position)} onChange={(event) => toggle(position.position, event.target.checked)} />{" "}
                      <span>
                        <strong>{labels.position.replace("{n}", String(position.position))}</strong>, {formats[position.format as keyof typeof formats] ?? position.format}, {labels.points.replace("{points}", formatPoints(position.points, locale))}
                        {position.areas.length > 0 && <span className="form__hint"> {labels.areas.replace("{areas}", position.areas.map((area) => area.name).join(", "))}</span>}
                      </span>
                    </label>
                  ))}
                </fieldset>
                <p className="form__hint" aria-live="polite">{labels.selected.replace("{n}", String(chosen.length)).replace("{points}", formatPoints(chosenPoints, locale))}</p>
                <div className="form--grid form">
                  <div className="form__field">
                    <label htmlFor="send-minutes">{labels.minutes}</label>
                    <input id="send-minutes" name="minutes" type="number" min={1} max={300} inputMode="numeric" required />
                    {subject.minutes !== null && <p className="form__hint">{labels.minutesHint.replace("{n}", String(subject.minutes))}</p>}
                  </div>
                </div>
                <p className="form__hint">{labels.partNotCounted}</p>
              </>
            )}

            <fieldset className="form__field">
              <legend>{labels.audience}</legend>
              <div className="practice-choices">
                <label className="practice-choice"><input type="radio" name="audience" value="all" checked={audience === "all"} onChange={() => setAudience("all")} /> <span>{labels.audienceAll}</span></label>
                <label className="practice-choice"><input type="radio" name="audience" value="chosen" checked={audience === "chosen"} onChange={() => setAudience("chosen")} /> <span>{labels.audienceChosen}</span></label>
              </div>
            </fieldset>
            {audience === "chosen" && (
              <fieldset className="form__field assignment-students">
                <legend>{labels.students}</legend>
                {students.length === 0 ? <p>{labels.noStudents}</p> : students.map((student) => (
                  <label key={student.personId} className="practice-choice">
                    <input type="checkbox" name="personIds" value={student.personId} defaultChecked={student.personId === preset.student} /> <span>{student.name}</span>
                  </label>
                ))}
              </fieldset>
            )}

            <div className="form__field">
              <label htmlFor="send-note">{labels.note}</label>
              <textarea id="send-note" name="note" maxLength={1000} rows={2} />
            </div>

            <div className="form__actions">
              <button type="submit" className="button-primary" disabled={pending || (kind === "part" && chosen.length === 0)} aria-busy={pending}>{labels.submit}</button>
              <p className="action-feedback" aria-live="polite">
                {result?.success && <span className="action-feedback--ok">{labels.created.replace("{n}", String(result.data.created))}</span>}
                {result?.success && result.data.skipped.length > 0 && <span className="form__hint"> {labels.skipped.replace("{names}", result.data.skipped.join(", "))}</span>}
                {result && !result.success && <span className="action-feedback--error">{dictionary.grading.errors[result.code]}</span>}
              </p>
            </div>
          </>
        )}
      </form>
    </section>
  );
}

function SentList({ sent }: { sent: SentTest[] }): ReactNode {
  const { dictionary, locale } = useI18n();
  const labels = dictionary.grading.send;
  const exam = dictionary.exam;

  return (
    <section className="card" aria-labelledby="send-list">
      <h2 id="send-list">{labels.list}</h2>
      {sent.length === 0 ? (
        <p>{labels.none}</p>
      ) : (
        <div className="table-scroll" tabIndex={0} role="region" aria-label={dictionary.common.table}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{labels.columns.date}</th>
                <th>{labels.columns.subject}</th>
                <th>{labels.columns.test}</th>
                <th>{labels.columns.minutes}</th>
                <th>{labels.columns.audience}</th>
                <th>{labels.columns.sentBy}</th>
                <th>{labels.columns.sets}</th>
              </tr>
            </thead>
            <tbody>
              {sent.map((test) => (
                <tr key={test.id}>
                  <td>{formatDateTime(test.createdAt, locale)}</td>
                  <td>{dictionary.subjects[test.subjectCode]}</td>
                  <td>
                    {testLabel(test.kind, test.positions, { full: exam.kindFull, part: exam.kindPart })}
                    {test.note && <span className="form__hint support-cell">{test.note}</span>}
                  </td>
                  <td>{test.minutes ?? ""}</td>
                  <td>{labels.audienceValue[test.audience]}</td>
                  <td>{test.sentBy}</td>
                  <td>
                    {STATES.filter((state) => (test.states[state] ?? 0) > 0).map((state) => (
                      <span key={state} className="support-cell">{exam.states[state]}: {test.states[state]}</span>
                    ))}
                    <details>
                      <summary>{labels.columns.sets}</summary>
                      <ul>
                        {test.sets.map((set) => (
                          <li key={set.id}>
                            <Link href={`${GRADING_PATH}/${set.id}`}>{set.student}</Link>
                            {": "}
                            {set.status === "graded" && set.points !== null
                              ? exam.pointsOf.replace("{p}", formatPoints(set.points, locale)).replace("{max}", formatPoints(set.max, locale))
                              : exam.states[set.status]}
                          </li>
                        ))}
                      </ul>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
