"use client";

import Link from "next/link";
import { useActionState, type ReactNode } from "react";
import { ASSIGNMENTS_PATH, SUPPORT_PATH } from "@/constants";
import { formatDateTime } from "@/features/canon/components/format";
import { useI18n } from "@/features/localization/i18n-provider";
import { ReviewShell } from "@/features/review/components/review-shell";
import { withdrawAssignmentAction } from "../actions";
import type { AssignmentActionResult, AssignmentDetail } from "../types";

/** One assignment (PDL-035): questions by catalogue key and the facts of every student; withdrawal with a reason. */
export function AssignmentDetailScreen({ assignment, canExport, canOpenProfiles }: { assignment: AssignmentDetail; canExport: boolean; canOpenProfiles: boolean }): ReactNode {
  const { dictionary, locale } = useI18n();
  const labels = dictionary.assignments;
  const subtitle = `${dictionary.subjects[assignment.subject]}, ${labels.detail.due}: ${formatDateTime(assignment.dueAt, locale)}`;

  return (
    <ReviewShell
      backHref={ASSIGNMENTS_PATH}
      backLabel={labels.backToList}
      title={assignment.title}
      subtitle={subtitle}
      print={{ confidential: true, exportHref: canExport ? `${ASSIGNMENTS_PATH}/${assignment.id}/izvoz` : undefined }}
    >
      {assignment.withdrawal && <p className="notice">{labels.detail.withdrawal.replace("{reason}", assignment.withdrawal.reason)}</p>}
      <section className="card">
        <dl className="canon-version__meta">
          <div><dt>{labels.detail.author}</dt><dd>{assignment.author}</dd></div>
          <div><dt>{labels.detail.created}</dt><dd>{formatDateTime(assignment.createdAt, locale)}</dd></div>
          <div><dt>{labels.audience}</dt><dd>{assignment.audience === "all" ? labels.detail.audienceAll : labels.detail.audienceChosen}</dd></div>
        </dl>
        {assignment.instruction && <p><strong>{labels.detail.instruction}:</strong> {assignment.instruction}</p>}
        <h2>{labels.detail.questions}</h2>
        <p>{assignment.questions.map((question) => question.key).join(", ")}</p>
      </section>

      <section className="card" aria-labelledby="assignment-recipients">
        <h2 id="assignment-recipients">{labels.detail.recipients}</h2>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>{dictionary.support.columns.student}</th>
                <th>{labels.detail.answered}</th>
                <th>{labels.detail.correct}</th>
                <th>{labels.detail.completedAt}</th>
                <th>{labels.detail.state}</th>
              </tr>
            </thead>
            <tbody>
              {assignment.recipients.map((recipient) => (
                <tr key={recipient.personId}>
                  <td>{canOpenProfiles ? <Link href={`${SUPPORT_PATH}/${recipient.personId}`}>{recipient.name}</Link> : recipient.name}</td>
                  <td>{recipient.answered} / {recipient.total}</td>
                  <td>{recipient.correct}</td>
                  <td>{recipient.completedAt ? formatDateTime(recipient.completedAt, locale) : ""}</td>
                  <td><span className="status-pill" data-assignment={recipient.state}>{labels.states[recipient.state]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="form__hint">{labels.statesHint}</p>
      </section>

      {!assignment.withdrawal && <Withdraw assignmentId={assignment.id} />}
    </ReviewShell>
  );
}

function Withdraw({ assignmentId }: { assignmentId: string }): ReactNode {
  const { dictionary } = useI18n();
  const labels = dictionary.assignments;
  const [result, formAction, pending] = useActionState<AssignmentActionResult | null, FormData>(withdrawAssignmentAction, null);
  return (
    <section className="card no-print" aria-labelledby="assignment-withdraw">
      <h2 id="assignment-withdraw">{labels.withdraw.title}</h2>
      <p className="form__hint">{labels.withdraw.hint}</p>
      <form action={formAction} className="form">
        <input type="hidden" name="assignmentId" value={assignmentId} />
        <div className="form__field">
          <label htmlFor="withdraw-reason">{labels.withdraw.reason}</label>
          <input id="withdraw-reason" name="reason" required maxLength={500} />
        </div>
        <div className="form__actions">
          <button type="submit" className="button-secondary" disabled={pending}>{labels.withdraw.submit}</button>
          <p className="action-feedback" aria-live="polite">
            {result?.success && <span className="action-feedback--ok">{labels.withdraw.done}</span>}
            {result && !result.success && <span className="action-feedback--error">{labels.errors[result.code]}</span>}
          </p>
        </div>
      </form>
    </section>
  );
}
