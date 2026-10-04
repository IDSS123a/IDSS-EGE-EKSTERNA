"use client";

import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";
import { APP_HOME_PATH, ASSIGNMENTS_PATH } from "@/constants";
import { formatDateTime } from "@/features/canon/components/format";
import type { SubjectCode } from "@/features/knowledge/types";
import { useI18n } from "@/features/localization/i18n-provider";
import { ReviewShell } from "@/features/review/components/review-shell";
import { createAssignmentAction } from "../actions";
import type { AssignmentActionResult, AssignmentFormOptions, AssignmentState, AssignmentSummary } from "../types";

const STATES: AssignmentState[] = ["open", "complete", "late", "missed"];

/**
 * Zadaci za učenike (PDL-035): the teacher gives trusted catalogue questions of the own subject, picked by key or drawn
 * from an area, to all active students or to chosen ones, with a required due date; below, the given assignments with
 * the number of students per state. Facts only: "complete" means every question answered, whatever the result (Z3).
 */
type Preset = { subject: string | null; student: string | null; area: string | null };

export function AssignmentsHomeScreen({ assignments, options, preset }: { assignments: AssignmentSummary[]; options: AssignmentFormOptions; preset: Preset }): ReactNode {
  const { dictionary, locale } = useI18n();
  const labels = dictionary.assignments;

  return (
    <ReviewShell backHref={APP_HOME_PATH} backLabel={labels.back} title={labels.title} subtitle={labels.subtitle} print={{ confidential: false }}>
      {options.subjects.length > 0 && <NewAssignment options={options} preset={preset} />}

      <section className="card" aria-labelledby="assignments-list">
        <h2 id="assignments-list">{labels.list}</h2>
        {assignments.length === 0 ? (
          <p>{labels.none}</p>
        ) : (
          <div className="table-scroll" tabIndex={0} role="region" aria-label={dictionary.common.table}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{labels.columns.title}</th>
                  <th>{labels.columns.subject}</th>
                  <th>{labels.columns.due}</th>
                  <th>{labels.columns.questions}</th>
                  <th>{labels.columns.states}</th>
                  <th>{labels.columns.author}</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((assignment) => (
                  <tr key={assignment.id}>
                    <td>
                      <Link href={`${ASSIGNMENTS_PATH}/${assignment.id}`}>{assignment.title}</Link>
                      {assignment.withdrawn && <span className="form__hint"> ({labels.withdrawn})</span>}
                    </td>
                    <td>{dictionary.subjects[assignment.subject]}</td>
                    <td>{formatDateTime(assignment.dueAt, locale)}</td>
                    <td>{assignment.questions}</td>
                    <td>
                      {STATES.filter((state) => (assignment.states[state] ?? 0) > 0).map((state) => (
                        <span key={state} className="support-cell">{labels.states[state]}: {assignment.states[state]}</span>
                      ))}
                    </td>
                    <td>{assignment.author}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="form__hint">{labels.statesHint}</p>
      </section>
    </ReviewShell>
  );
}

function NewAssignment({ options, preset }: { options: AssignmentFormOptions; preset: Preset }): ReactNode {
  const { dictionary } = useI18n();
  const labels = dictionary.assignments;
  const [result, formAction, pending] = useActionState<AssignmentActionResult | null, FormData>(createAssignmentAction, null);
  const initial = options.subjects.find((entry) => entry.code === preset.subject) ?? options.subjects[0];
  const presetArea = initial.areas.find((area) => area.label === preset.area)?.id;
  const [subject, setSubject] = useState<SubjectCode>(initial.code);
  const [content, setContent] = useState<"keys" | "area">(presetArea ? "area" : "keys");
  const [audience, setAudience] = useState<"all" | "chosen">(preset.student ? "chosen" : "all");
  const areas = options.subjects.find((entry) => entry.code === subject)?.areas ?? [];

  return (
    <section className="card no-print" aria-labelledby="assignment-new">
      <h2 id="assignment-new">{labels.newTitle}</h2>
      <form key={result?.success ? result.data.id : "new"} action={formAction} className="form">
        <div className="form--grid form">
          <div className="form__field">
            <label htmlFor="assignment-subject">{labels.subject}</label>
            <select id="assignment-subject" name="subject" value={subject} onChange={(event) => setSubject(event.target.value as SubjectCode)}>
              {options.subjects.map((entry) => <option key={entry.code} value={entry.code}>{dictionary.subjects[entry.code]}</option>)}
            </select>
          </div>
          <div className="form__field">
            <label htmlFor="assignment-title">{labels.name}</label>
            <input id="assignment-title" name="title" required maxLength={120} />
          </div>
          <div className="form__field">
            <label htmlFor="assignment-due">{labels.due}</label>
            <input id="assignment-due" name="due" type="datetime-local" required />
          </div>
        </div>
        <div className="form__field">
          <label htmlFor="assignment-instruction">{labels.instruction}</label>
          <textarea id="assignment-instruction" name="instruction" maxLength={1000} rows={2} />
        </div>

        <fieldset className="form__field">
          <legend>{labels.content}</legend>
          <div className="practice-choices">
          <label className="practice-choice"><input type="radio" name="content" value="keys" checked={content === "keys"} onChange={() => setContent("keys")} /> <span>{labels.contentKeys}</span></label>
          <label className="practice-choice"><input type="radio" name="content" value="area" checked={content === "area"} onChange={() => setContent("area")} /> <span>{labels.contentArea}</span></label>
          </div>
        </fieldset>
        {content === "keys" ? (
          <div className="form__field">
            <label htmlFor="assignment-keys">{labels.keys}</label>
            <textarea id="assignment-keys" name="keys" rows={2} required />
            <p className="form__hint">{labels.keysHint}</p>
          </div>
        ) : (
          <div className="form--grid form">
            <div className="form__field">
              <label htmlFor="assignment-area">{labels.area}</label>
              <select id="assignment-area" name="areaId" required defaultValue={subject === initial.code ? presetArea : undefined}>
                {areas.map((area) => <option key={area.id} value={area.id}>{area.label}</option>)}
              </select>
            </div>
            <div className="form__field">
              <label htmlFor="assignment-count">{labels.count}</label>
              <input id="assignment-count" name="count" type="number" min={1} max={50} inputMode="numeric" required />
            </div>
          </div>
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
            {options.students.length === 0 ? <p>{labels.noStudents}</p> : options.students.map((student) => (
              <label key={student.personId} className="practice-choice">
                <input type="checkbox" name="personIds" value={student.personId} defaultChecked={student.personId === preset.student} /> <span>{student.name}</span>
              </label>
            ))}
          </fieldset>
        )}

        <div className="form__actions">
          <button type="submit" className="button-primary" disabled={pending}>{labels.create}</button>
          <p className="action-feedback" aria-live="polite">
            {result?.success && <span className="action-feedback--ok">{labels.created}</span>}
            {result && !result.success && <span className="action-feedback--error">{labels.errors[result.code]}</span>}
          </p>
        </div>
      </form>
    </section>
  );
}
