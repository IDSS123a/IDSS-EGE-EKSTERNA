"use client";

import { useActionState, type FormEvent, type ReactNode } from "react";
import { GRADING_PATH, REVIEW_TEXT_MAX_LENGTH } from "@/constants";
import { formatDateTime } from "@/features/canon/components/format";
import { formatPoints, groupByPosition } from "@/features/exams/domain/exam";
import type { ExamUnit } from "@/features/exams/types";
import { useI18n } from "@/features/localization/i18n-provider";
import { ReviewShell } from "@/features/review/components/review-shell";
import { approveSetAction, confirmGradesAction, discardSetAction, saveGradesAction } from "../actions";
import { pairChoices } from "../domain/blueprint";
import type { GradingActionResult, GradingView } from "../types";

/**
 * One mock exam for a teacher (Sprint 07, P-15). A set waiting for approval shows every question as printed with its
 * printed key, errata and open follow-ups; the teacher approves it or discards it with a reason. A submitted exam
 * shows the student's answers beside the printed key and the pre-scored proposals; the teacher gives points the unit
 * allows (pairs for matching), saves and confirms the result.
 */
export function GradingExamScreen({ exam }: { exam: GradingView }): ReactNode {
  const { dictionary, locale } = useI18n();
  const labels = dictionary.grading;
  const lang = exam.subjectCode === "german" ? "de" : "bs";
  const grading = exam.status === "submitted";

  return (
    <ReviewShell backHref={GRADING_PATH} backLabel={labels.backToQueue} title={exam.student} subtitle={`${dictionary.subjects[exam.subjectCode]}, ${dictionary.exam.states[exam.status]}`} print={{ confidential: true }}>
      <section className="card">
        <dl className="canon-version__meta">
          <div><dt>{labels.exam.requested}</dt><dd>{formatDateTime(exam.createdAt, locale)}</dd></div>
          {exam.submittedAt && <div><dt>{labels.exam.submitted}</dt><dd>{formatDateTime(exam.submittedAt, locale)}{exam.autoSubmitted ? `, ${labels.queue.auto}` : ""}</dd></div>}
          <div><dt>{labels.exam.points}</dt><dd>{exam.totalPoints !== null ? dictionary.exam.pointsOf.replace("{p}", formatPoints(exam.totalPoints, locale)).replace("{max}", formatPoints(exam.maxPoints, locale)) : formatPoints(exam.maxPoints, locale)}</dd></div>
        </dl>
        {exam.status === "awaiting_approval" && <p className="notice">{labels.exam.approvalHint}</p>}
        {grading && <p className="notice">{labels.exam.gradingHint}</p>}
      </section>

      {grading ? <GradesForm exam={exam} lang={lang} /> : <Questions exam={exam} lang={lang} editable={false} />}

      {exam.status === "awaiting_approval" && <ApprovalForms exam={exam} />}
    </ReviewShell>
  );
}

function ApprovalForms({ exam }: { exam: GradingView }): ReactNode {
  const { dictionary } = useI18n();
  const labels = dictionary.grading;
  const [approved, approveAction, approving] = useActionState<GradingActionResult | null, FormData>(approveSetAction, null);
  const [discarded, discardAction, discarding] = useActionState<GradingActionResult | null, FormData>(discardSetAction, null);
  const done = approved?.success || discarded?.success;
  const confirmApprove = (event: FormEvent<HTMLFormElement>): void => {
    if (!window.confirm(labels.exam.confirmApprove)) event.preventDefault();
  };

  return (
    <section className="card" aria-label={labels.exam.decision}>
      <form action={approveAction} onSubmit={confirmApprove} className="link-row">
        <input type="hidden" name="examId" value={exam.id} />
        <input type="hidden" name="subjectId" value={exam.subjectId} />
        <button type="submit" className="button-primary" disabled={approving || Boolean(done)}>{labels.exam.approve}</button>
      </form>
      <details className="review-text-details">
        <summary>{labels.exam.discard}</summary>
        <form action={discardAction} className="form form--grid">
          <input type="hidden" name="examId" value={exam.id} />
          <input type="hidden" name="subjectId" value={exam.subjectId} />
          <div className="form__field">
            <label htmlFor={`discard-note-${exam.id}`}>{labels.exam.discardReason}</label>
            <input id={`discard-note-${exam.id}`} name="note" required maxLength={REVIEW_TEXT_MAX_LENGTH} />
          </div>
          <label className="practice-choice">
            <input type="checkbox" name="newSet" defaultChecked />
            <span>{labels.exam.newSet}</span>
          </label>
          <div className="form__actions">
            <button type="submit" className="button-secondary" disabled={discarding || Boolean(done)}>{labels.exam.discardSubmit}</button>
          </div>
        </form>
      </details>
      <p aria-live="polite">
        {[approved, discarded].map((result, index) =>
          result?.success ? <span key={index} className="action-feedback--ok">{labels.messages[result.data.message]}</span> : result ? <span key={index} className="action-feedback--error">{labels.errors[result.code]}</span> : null,
        )}
      </p>
    </section>
  );
}

function GradesForm({ exam, lang }: { exam: GradingView; lang: string }): ReactNode {
  const { dictionary } = useI18n();
  const labels = dictionary.grading;
  const [saved, saveAction, saving] = useActionState<GradingActionResult | null, FormData>(saveGradesAction, null);
  const [confirmed, confirmAction, confirming] = useActionState<GradingActionResult | null, FormData>(confirmGradesAction, null);
  const confirmResult = (event: FormEvent<HTMLFormElement>): void => {
    if (!window.confirm(labels.exam.confirmResult)) event.preventDefault();
  };

  return (
    <>
      <form action={saveAction} className="form">
        <input type="hidden" name="examId" value={exam.id} />
        <input type="hidden" name="subjectId" value={exam.subjectId} />
        <Questions exam={exam} lang={lang} editable />
        <div className="form__actions">
          <button type="submit" className="button-primary" disabled={saving}>{labels.exam.save}</button>
          <p className="action-feedback" aria-live="polite">
            {saved?.success && <span className="action-feedback--ok">{labels.messages[saved.data.message]}</span>}
            {saved && !saved.success && <span className="action-feedback--error">{labels.errors[saved.code]}</span>}
          </p>
        </div>
      </form>
      <section className="card">
        <p>{labels.exam.confirmHint}</p>
        <form action={confirmAction} onSubmit={confirmResult} className="link-row">
          <input type="hidden" name="examId" value={exam.id} />
          <input type="hidden" name="subjectId" value={exam.subjectId} />
          <button type="submit" className="button-primary" disabled={confirming || confirmed?.success === true}>{labels.exam.confirmSubmit}</button>
          <span aria-live="polite">
            {confirmed?.success && <span className="action-feedback--ok">{labels.messages[confirmed.data.message]}</span>}
            {confirmed && !confirmed.success && <span className="action-feedback--error">{labels.errors[confirmed.code]}</span>}
          </span>
        </form>
      </section>
    </>
  );
}

function Questions({ exam, lang, editable }: { exam: GradingView; lang: string; editable: boolean }): ReactNode {
  const { dictionary } = useI18n();
  const practice = dictionary.practice;
  const labels = dictionary.grading;

  return (
    <>
      {groupByPosition(exam.units).map((position) => (
        <section key={position.position} className="card practice-question" aria-labelledby={`grading-position-${position.position}`}>
          <h2 id={`grading-position-${position.position}`}>{dictionary.exam.task.replace("{n}", String(position.position))}</h2>
          {position.questions.map(({ questionVersionId, units }) => {
            const question = exam.questions[questionVersionId];
            const followUps = exam.followUps[questionVersionId] ?? [];
            return (
              <div key={questionVersionId} className="exam-question">
                {question && (
                  <p className="form__hint">
                    {question.recordKey}, {practice.source.replace("{title}", question.source.officialTitle).replace("{page}", String(question.source.page ?? ""))}
                  </p>
                )}
                {followUps.map((followUp, index) => (
                  <p key={index} className="notice" role="note">{labels.exam.followUp.replace("{name}", followUp.assignee).replace("{note}", followUp.note)}</p>
                ))}
                {question && question.errataDetails.length > 0 && (
                  <section className="practice-erratum-details" aria-label={practice.erratumTitle}>
                    <h3>{practice.erratumTitle}</h3>
                    <ul>
                      {question.errataDetails.map((erratum, index) => (
                        <li key={index}>
                          {erratum.item !== null && <strong>{practice.item.replace("{n}", String(erratum.item))}: </strong>}
                          <span lang="bs">{erratum.description}</span> <span className="form__hint">({erratum.evidence})</span>
                        </li>
                      ))}
                    </ul>
                    <p className="form__hint">{practice.erratumKeyStands}</p>
                  </section>
                )}
                {question?.transcript && (
                  <details className="practice-transcript">
                    <summary>{practice.transcript}</summary>
                    <pre className="review-record__text" lang="de">{question.transcript}</pre>
                  </details>
                )}
                {question?.crop ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="question-crop" src={question.crop} alt={question.text} lang={lang} />
                ) : (
                  question && <pre className="review-record__text" lang={lang}>{question.text}</pre>
                )}
                {units.map((unit) => <UnitLine key={unit.id} unit={unit} exam={exam} lang={lang} editable={editable} />)}
              </div>
            );
          })}
        </section>
      ))}
    </>
  );
}

function UnitLine({ unit, exam, lang, editable }: { unit: ExamUnit; exam: GradingView; lang: string; editable: boolean }): ReactNode {
  const { dictionary, locale } = useI18n();
  const labels = dictionary.grading.exam;
  const practice = dictionary.practice;
  const proposed = exam.proposedPoints[unit.id] ?? null;
  const pairs = unit.scoring === "matching" ? pairChoices(exam.pairsRule) : [];
  const title = `${unit.item !== null ? practice.item.replace("{n}", String(unit.item)) : practice.answer} (${dictionary.exam.pointsMax.replace("{p}", formatPoints(unit.maxPoints, locale))})`;
  const showResponse = exam.status !== "awaiting_approval" && exam.status !== "approved";

  return (
    <fieldset className="practice-item">
      <legend>{title}</legend>
      {editable && <input type="hidden" name="unit" value={unit.id} />}
      <div className="grading-unit">
        <dl>
          <dt>{labels.printedKey}</dt>
          <dd><pre className="review-record__text review-record__key grading-key" lang={lang}>{unit.solution ?? labels.noKey}</pre></dd>
        </dl>
        {showResponse && (
          <dl>
            <dt>{labels.response}</dt>
            <dd><pre className="review-record__text" lang={lang}>{unit.response.trim() || practice.empty_answer}</pre></dd>
            {proposed !== null && <dd className="form__hint">{labels.proposed.replace("{p}", formatPoints(proposed, locale))}</dd>}
            {unit.finalPoints !== null && !editable && <dd><strong>{dictionary.exam.pointsOf.replace("{p}", formatPoints(unit.finalPoints, locale)).replace("{max}", formatPoints(unit.maxPoints, locale))}</strong></dd>}
          </dl>
        )}
        {editable && (
          <div className="form__field">
            {unit.scoring === "matching" ? (
              <>
                <label htmlFor={`pairs-${unit.id}`}>{labels.pairs}</label>
                <select id={`pairs-${unit.id}`} name={`pairs:${unit.id}`} defaultValue={unit.correctPairs === null ? "" : String(unit.correctPairs)}>
                  <option value="">{labels.keep}</option>
                  {pairs.map((count) => (
                    <option key={count} value={count}>
                      {labels.pairsOption.replace("{n}", String(count)).replace("{p}", formatPoints(exam.pairsRule?.[String(count)] ?? 0, locale))}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <>
                <label htmlFor={`points-${unit.id}`}>{labels.points}</label>
                <select id={`points-${unit.id}`} name={`points:${unit.id}`} defaultValue={unit.finalPoints === null ? "" : String(unit.finalPoints)}>
                  <option value="">{proposed !== null ? labels.keepProposal.replace("{p}", formatPoints(proposed, locale)) : labels.keep}</option>
                  {unit.allowedPoints.map((points) => <option key={points} value={points}>{formatPoints(points, locale)}</option>)}
                </select>
              </>
            )}
            <label htmlFor={`note-${unit.id}`}>{labels.note}</label>
            <input id={`note-${unit.id}`} name={`note:${unit.id}`} maxLength={REVIEW_TEXT_MAX_LENGTH} defaultValue={unit.note ?? ""} />
          </div>
        )}
      </div>
    </fieldset>
  );
}
