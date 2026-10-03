"use client";

import { useActionState, type ReactNode } from "react";
import { GRADING_PATH, REVIEW_TEXT_MAX_LENGTH } from "@/constants";
import { formatDateTime } from "@/features/canon/components/format";
import { useI18n } from "@/features/localization/i18n-provider";
import { ReviewShell } from "@/features/review/components/review-shell";
import { reviewPracticeAnswerAction } from "../actions";
import type { GradingActionResult, PracticeReviewEntry } from "../types";

const VERDICTS = ["correct", "partly_correct", "incorrect"] as const;

/**
 * Practice answers waiting for the teacher (Sprint 08, migration 021): the question as printed (P-15), the student's
 * answer beside the printed key and errata, and a verdict that counts for practice progress only (P-7).
 */
export function PracticeReviewScreen({ entries }: { entries: PracticeReviewEntry[] }): ReactNode {
  const { dictionary } = useI18n();
  const labels = dictionary.grading.practice;

  return (
    <ReviewShell backHref={GRADING_PATH} backLabel={dictionary.grading.backToQueue} title={labels.title} subtitle={labels.subtitle}>
      <p className="notice">{labels.hint}</p>
      {entries.length === 0 && <p className="notice">{labels.empty}</p>}
      {entries.map((entry) => <EntryCard key={entry.id} entry={entry} />)}
    </ReviewShell>
  );
}

function EntryCard({ entry }: { entry: PracticeReviewEntry }): ReactNode {
  const { dictionary, locale } = useI18n();
  const labels = dictionary.grading.practice;
  const practice = dictionary.practice;
  const [result, formAction, pending] = useActionState<GradingActionResult | null, FormData>(reviewPracticeAnswerAction, null);
  const lang = entry.subjectCode === "german" ? "de" : "bs";
  const done = result?.success === true;
  const itemLabel = (item: number | null) => (item === null ? labels.answer : practice.item.replace("{n}", String(item)));

  return (
    <section className="card practice-question" aria-labelledby={`practice-review-${entry.id}`}>
      <h2 id={`practice-review-${entry.id}`}>{entry.student}, {dictionary.subjects[entry.subjectCode]}</h2>
      <p className="form__hint">
        {entry.question.recordKey}, {formatDateTime(entry.submittedAt, locale)}
      </p>
      {entry.errata.length > 0 && (
        <section className="practice-erratum-details" aria-label={practice.erratumTitle}>
          <h3>{practice.erratumTitle}</h3>
          <ul>
            {entry.errata.map((erratum, index) => (
              <li key={index}>
                {erratum.item !== null && <strong>{practice.item.replace("{n}", String(erratum.item))}: </strong>}
                <span lang="bs">{erratum.description}</span> <span className="form__hint">({erratum.evidence})</span>
              </li>
            ))}
          </ul>
          <p className="form__hint">{practice.erratumKeyStands}</p>
        </section>
      )}
      {entry.question.crop ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="question-crop" src={entry.question.crop} alt={entry.question.text} lang={lang} />
      ) : (
        <pre className="review-record__text" lang={lang}>{entry.question.text}</pre>
      )}
      {entry.responses.map((response) => {
        const key = entry.keys.find((candidate) => candidate.item === response.item) ?? (entry.keys.length === 1 ? entry.keys[0] : undefined);
        return (
          <div key={response.item ?? "task"} className="grading-unit practice-item">
            <dl>
              <dt>{labels.printedKey}</dt>
              <dd><pre className="review-record__text review-record__key grading-key" lang={lang}>{key?.key ?? dictionary.grading.exam.noKey}</pre></dd>
            </dl>
            <dl>
              <dt>{itemLabel(response.item)}</dt>
              <dd><pre className="review-record__text" lang={lang}>{response.response.trim() || practice.empty_answer}</pre></dd>
            </dl>
          </div>
        );
      })}
      <form action={formAction} className="form">
        <input type="hidden" name="answerId" value={entry.id} />
        <fieldset className="practice-item">
          <legend>{labels.verdict}</legend>
          <div className="practice-choices" role="radiogroup">
            {VERDICTS.map((verdict) => (
              <label key={verdict} className="practice-choice">
                <input type="radio" name="verdict" value={verdict} required disabled={pending || done} />
                <span>{labels.verdicts[verdict]}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="form__field">
          <label htmlFor={`practice-note-${entry.id}`}>{labels.note}</label>
          <input id={`practice-note-${entry.id}`} name="note" maxLength={REVIEW_TEXT_MAX_LENGTH} disabled={done} />
        </div>
        <div className="form__actions">
          <button type="submit" className="button-primary" disabled={pending || done}>{labels.submit}</button>
          <p className="action-feedback" aria-live="polite">
            {result?.success && <span className="action-feedback--ok">{dictionary.grading.messages[result.data.message]}</span>}
            {result && !result.success && <span className="action-feedback--error">{dictionary.grading.errors[result.code]}</span>}
          </p>
        </div>
      </form>
    </section>
  );
}
