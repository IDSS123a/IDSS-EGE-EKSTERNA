"use client";

import Link from "next/link";
import { useActionState, type ReactNode } from "react";
import { APP_HOME_PATH, PRACTICE_PATH, PRACTICE_RESPONSE_MAX_LENGTH, SUBJECT_PATH } from "@/constants";
import type { SubjectCode } from "@/features/knowledge/types";
import { useI18n } from "@/features/localization/i18n-provider";
import { ReviewShell } from "@/features/review/components/review-shell";
import { submitPracticeAnswerAction } from "../actions";
import type { PracticeItem, PracticeQuestion, PracticeResult, PracticeSubmitResult } from "../types";

type Props = { code: SubjectCode; areaId: string | null; question: PracticeQuestion | null };

/**
 * One practice question (Sprint 06, PDL-018): the student answers first; only the database's answer to the submission
 * carries the solution. Catalogue text is shown verbatim in its source language (AMB-13, P-13 exempt).
 */
export function PracticeScreen({ code, areaId, question }: Props): ReactNode {
  const { dictionary } = useI18n();
  const labels = dictionary.practice;
  const [result, formAction, pending] = useActionState<PracticeSubmitResult | null, FormData>(submitPracticeAnswerAction, null);
  const lang = code === "german" ? "de" : "bs";
  const answered = result?.success ? result.data : null;
  const nextHref = `${PRACTICE_PATH}?predmet=${code}${areaId ? `&oblast=${areaId}` : ""}${question ? `&poslije=${question.questionVersionId}` : ""}`;
  const backHref = areaId ? `${SUBJECT_PATH}/${code}` : APP_HOME_PATH;

  return (
    <ReviewShell backHref={backHref} backLabel={areaId ? labels.backToSubject : labels.back} title={dictionary.subjects[code]} subtitle={question?.area ?? undefined}>
      {!question ? (
        <p className="notice">{labels.empty}</p>
      ) : (
        <section className="card practice-question" aria-labelledby="practice-title">
          <h2 id="practice-title" className="sr-only">{labels.title}</h2>
          <dl className="canon-version__meta">
            {question.area && <div><dt>{labels.area}</dt><dd lang={lang}>{question.area}</dd></div>}
            {question.catalogueLevel && <div><dt>{labels.level}</dt><dd lang={lang}>{question.catalogueLevel}</dd></div>}
          </dl>
          {question.transcript && (
            <details className="practice-transcript" open>
              <summary>{labels.transcript}</summary>
              <pre className="review-record__text" lang="de">{question.transcript}</pre>
            </details>
          )}
          <pre className="review-record__text practice-question__text" lang={lang}>{question.options.length > 0 && question.stem ? question.stem : question.text}</pre>
          {question.hasFigure && question.source.page && <p className="notice">{labels.figure.replace("{page}", String(question.source.page))}</p>}

          <form action={formAction} className="form practice-form">
            <input type="hidden" name="questionVersionId" value={question.questionVersionId} />
            <input type="hidden" name="subjectId" value={question.subjectId} />
            {question.items.map((item, index) => (
              <ItemInput key={item.item ?? "task"} index={index} item={item} question={question} lang={lang} disabled={pending || answered !== null} result={answered} />
            ))}
            {!answered && (
              <div className="form__actions">
                <button type="submit" className="button-primary" disabled={pending} aria-busy={pending}>{pending ? labels.submitting : labels.submit}</button>
              </div>
            )}
            <div aria-live="polite">
              {result && !result.success && <p className="action-feedback--error" role="alert">{labels.errors[result.code]}</p>}
            </div>
          </form>

          {answered && <Feedback result={answered} lang={lang} />}
          {answered && (
            <div className="link-row">
              <Link href={nextHref} className="button-primary">{labels.next}</Link>
            </div>
          )}
          <p className="form__hint">{labels.source.replace("{title}", question.source.officialTitle).replace("{page}", String(question.source.page ?? ""))}</p>
        </section>
      )}
    </ReviewShell>
  );
}

function ItemInput({ index, item, question, lang, disabled, result }: { index: number; item: PracticeItem; question: PracticeQuestion; lang: string; disabled: boolean; result: PracticeResult | null }): ReactNode {
  const { dictionary } = useI18n();
  const labels = dictionary.practice;
  // One field per item: radio groups of different items must not share a name.
  const name = `response:${index}`;
  const legend = item.item !== null ? labels.item.replace("{n}", String(item.item)) : item.mode === "open" ? labels.answer : labels.choose;
  const optionText = (label: string) => question.options.find((option) => option.label.toLowerCase() === label)?.text ?? null;
  const verdict = result?.results.find((entry) => entry.item === item.item)?.correct;

  return (
    <fieldset className="practice-item" data-correct={verdict === undefined || verdict === null ? undefined : String(verdict)}>
      <legend>{legend}</legend>
      <input type="hidden" name="item" value={item.item ?? ""} />
      {item.text && item.mode !== "choice" && <p className="practice-item__text" lang={lang}>{item.text}</p>}
      {item.text && item.mode === "choice" && <pre className="review-record__text" lang={lang}>{item.text}</pre>}
      {item.mode === "choice" && (
        <div className="practice-choices" role="radiogroup">
          {item.choices.map((choice) => (
            <label key={choice} className="practice-choice">
              <input type="radio" name={name} value={choice} required disabled={disabled} />
              <span><strong>{choice})</strong>{optionText(choice) ? <span lang={lang}> {optionText(choice)}</span> : null}</span>
            </label>
          ))}
        </div>
      )}
      {item.mode === "true_false" && (
        <div className="practice-choices" role="radiogroup">
          <label className="practice-choice"><input type="radio" name={name} value="r" required disabled={disabled} /><span>{labels.true}</span></label>
          <label className="practice-choice"><input type="radio" name={name} value="f" required disabled={disabled} /><span>{labels.false}</span></label>
        </div>
      )}
      {item.mode === "open" && (
        <>
          <textarea name={name} aria-label={legend} maxLength={PRACTICE_RESPONSE_MAX_LENGTH} rows={4} disabled={disabled} lang={lang} />
          <p className="form__hint">{labels.answerHint}</p>
        </>
      )}
    </fieldset>
  );
}

function Feedback({ result, lang }: { result: PracticeResult; lang: string }): ReactNode {
  const { dictionary } = useI18n();
  const labels = dictionary.practice;
  const headline = labels.outcome[result.outcome].replace("{c}", String(result.itemsCorrect)).replace("{n}", String(result.itemsChecked));
  return (
    <section className="practice-feedback" data-outcome={result.outcome} aria-live="polite">
      <p className="practice-feedback__headline"><strong>{headline}</strong></p>
      <ul className="practice-feedback__items">
        {result.results.map((entry) => (
          <li key={entry.item ?? "task"} data-correct={entry.correct === null ? undefined : String(entry.correct)}>
            {entry.item !== null && <strong>{labels.item.replace("{n}", String(entry.item))}: </strong>}
            <span>{labels.yourAnswer}: </span><span lang={lang}>{entry.response.trim() || labels.empty_answer}</span>
            <br />
            {entry.solution ? (
              <>
                <span>{labels.solution}: </span>
                <pre className="review-record__text review-record__key" lang={lang}>{entry.solution}</pre>
              </>
            ) : (
              <span>{labels.noSolution}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
