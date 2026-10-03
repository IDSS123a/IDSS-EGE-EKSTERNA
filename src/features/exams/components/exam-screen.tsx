"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { EXAM_AUTOSAVE_MS, EXAM_PATH, PRACTICE_RESPONSE_MAX_LENGTH } from "@/constants";
import { formatDateTime } from "@/features/canon/components/format";
import { useI18n } from "@/features/localization/i18n-provider";
import { ReviewShell } from "@/features/review/components/review-shell";
import { beginExamAction, saveExamAction, submitExamAction } from "../actions";
import { answeredCount, clockOffsetMs, formatClock, formatPoints, groupByPosition, remainingMs } from "../domain/exam";
import type { ExamActionResult, ExamUnit, ExamView } from "../types";

type Question = ExamView["questions"][string];

/**
 * One mock exam of the student (Sprint 07). Before the start only the state is known (the database sends no question);
 * while writing, the questions as printed (P-15), a countdown on the server clock and autosave; after grading, points,
 * the printed key and the teacher's notes. Catalogue text stays verbatim in its source language (AMB-13).
 */
export function ExamScreen({ exam }: { exam: ExamView }): ReactNode {
  const { dictionary } = useI18n();
  const labels = dictionary.exam;

  return (
    <ReviewShell backHref={EXAM_PATH} backLabel={labels.backToExams} title={dictionary.subjects[exam.subjectCode]} subtitle={labels.title} print={exam.status === "graded" ? { confidential: false } : undefined}>
      {exam.status === "awaiting_approval" && <Waiting exam={exam} />}
      {exam.status === "approved" && <BeforeStart exam={exam} />}
      {exam.status === "in_progress" && <Writer exam={exam} />}
      {exam.status === "submitted" && (
        <p className="notice" role="status">{exam.autoSubmitted ? labels.submittedAuto : labels.submitted}</p>
      )}
      {exam.status === "discarded" && <p className="notice">{labels.discarded}</p>}
      {exam.status === "graded" && <Result exam={exam} />}
    </ReviewShell>
  );
}

function Waiting({ exam }: { exam: ExamView }): ReactNode {
  const { dictionary, locale } = useI18n();
  const labels = dictionary.exam;
  const router = useRouter();
  return (
    <section className="card">
      <p className="notice" role="status">{labels.waiting}</p>
      <p className="form__hint">{labels.requestedAt.replace("{date}", formatDateTime(exam.createdAt, locale))}</p>
      <div className="link-row">
        <button type="button" className="button-secondary" onClick={() => router.refresh()}>{labels.refresh}</button>
      </div>
    </section>
  );
}

function BeforeStart({ exam }: { exam: ExamView }): ReactNode {
  const { dictionary, locale } = useI18n();
  const labels = dictionary.exam;
  const router = useRouter();
  const [result, formAction, pending] = useActionState<ExamActionResult | null, FormData>(async (previous, formData) => {
    const outcome = await beginExamAction(previous, formData);
    if (outcome.success) router.refresh();
    return outcome;
  }, null);
  const confirmStart = (event: FormEvent<HTMLFormElement>): void => {
    if (!window.confirm(labels.confirmStart)) event.preventDefault();
  };

  return (
    <section className="card" aria-labelledby="exam-start-title">
      <h2 id="exam-start-title">{labels.ready}</h2>
      <ul>
        {exam.minutes !== null && <li>{labels.ruleMinutes.replace("{minutes}", String(exam.minutes))}</li>}
        <li>{labels.rulePoints.replace("{points}", formatPoints(exam.maxPoints, locale))}</li>
        <li>{labels.ruleAutosave}</li>
        <li>{labels.ruleDeadline}</li>
      </ul>
      <form action={formAction} onSubmit={confirmStart} className="link-row">
        <input type="hidden" name="examId" value={exam.id} />
        <button type="submit" className="button-primary" disabled={pending} aria-busy={pending}>{labels.start}</button>
        <span aria-live="polite">{result && !result.success && <span className="action-feedback--error">{labels.errors[result.code]}</span>}</span>
      </form>
    </section>
  );
}

type SaveState = "idle" | "saving" | "saved" | "error";

function Writer({ exam }: { exam: ExamView }): ReactNode {
  const { dictionary } = useI18n();
  const labels = dictionary.exam;
  const router = useRouter();
  const lang = exam.subjectCode === "german" ? "de" : "bs";
  const [responses, setResponses] = useState<Record<string, string>>(() => Object.fromEntries(exam.units.map((unit) => [unit.id, unit.response])));
  const [deadlineAt, setDeadlineAt] = useState(exam.deadlineAt ?? exam.serverNow);
  // The countdown runs on the server clock: the offset is measured when the exam is loaded and on every save.
  const [offset, setOffset] = useState(() => clockOffsetMs(exam.serverNow, Date.now()));
  const [left, setLeft] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = useRef(false);
  const latest = useRef(responses);
  const finished = useRef(false);

  const payload = useCallback(() => Object.entries(latest.current).map(([id, response]) => ({ id, response })), []);

  const submit = useCallback(
    async (automatic: boolean) => {
      if (finished.current) return;
      finished.current = true;
      setSubmitting(true);
      const outcome = await submitExamAction({ examId: exam.id, responses: payload() });
      if (!outcome.success && outcome.code !== "CLOSED") {
        finished.current = false;
        setSubmitting(false);
        setError(labels.errors[outcome.code]);
        return;
      }
      dirty.current = false;
      if (automatic) setError(null);
      router.refresh();
    },
    [exam.id, labels.errors, payload, router],
  );

  const save = useCallback(async () => {
    if (!dirty.current || finished.current) return;
    dirty.current = false;
    setSaveState("saving");
    const outcome = await saveExamAction({ examId: exam.id, responses: payload() });
    if (!outcome.success) {
      dirty.current = true;
      setSaveState("error");
      if (outcome.code === "CLOSED") router.refresh();
      return;
    }
    if (outcome.data.status === "submitted") {
      finished.current = true;
      router.refresh();
      return;
    }
    setOffset(clockOffsetMs(outcome.data.serverNow, Date.now()));
    setDeadlineAt(outcome.data.deadlineAt);
    setSaveState("saved");
  }, [exam.id, payload, router]);

  useEffect(() => {
    const tick = () => {
      const ms = remainingMs(deadlineAt, Date.now(), offset);
      setLeft(ms);
      if (ms === 0) void submit(true);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [deadlineAt, offset, submit]);

  useEffect(() => {
    const timer = window.setInterval(() => void save(), EXAM_AUTOSAVE_MS);
    return () => window.clearInterval(timer);
  }, [save]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty.current && !finished.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const change = (unitId: string, value: string) => {
    latest.current = { ...latest.current, [unitId]: value };
    dirty.current = true;
    setResponses(latest.current);
    setSaveState("idle");
  };

  const confirmSubmit = () => {
    const open = exam.units.length - answeredCount(latest.current);
    const question = open > 0 ? labels.confirmSubmitOpen.replace("{n}", String(open)) : labels.confirmSubmit;
    if (window.confirm(question)) void submit(false);
  };

  return (
    <>
      <div className="exam-bar card" role="region" aria-label={labels.timeLeft}>
        <p className="exam-bar__clock">
          <span>{labels.timeLeft}: </span>
          <strong role="timer" aria-live="off" data-low={left !== null && left < 5 * 60_000 ? "true" : undefined}>{left === null ? "" : formatClock(left)}</strong>
        </p>
        <p>{labels.answered.replace("{n}", String(answeredCount(responses))).replace("{total}", String(exam.units.length))}</p>
        <p className="form__hint" aria-live="polite">{saveState === "idle" ? "" : labels.save[saveState]}</p>
        <div className="link-row">
          <button type="button" className="button-secondary" onClick={() => void save()} disabled={submitting}>{labels.saveNow}</button>
          <button type="button" className="button-primary" onClick={confirmSubmit} disabled={submitting} aria-busy={submitting}>{labels.submit}</button>
        </div>
        {error && <p className="action-feedback--error" role="alert">{error}</p>}
      </div>

      {groupByPosition(exam.units).map((position) => (
        <section key={position.position} className="card practice-question" aria-labelledby={`exam-position-${position.position}`}>
          <h2 id={`exam-position-${position.position}`}>{labels.task.replace("{n}", String(position.position))}</h2>
          {position.questions.map(({ questionVersionId, units }) => {
            const question = exam.questions[questionVersionId];
            return (
              <div key={questionVersionId} className="exam-question">
                {question && <PrintedQuestion question={question} lang={lang} />}
                {units.map((unit) => (
                  <UnitInput key={unit.id} unit={unit} question={question} lang={lang} value={responses[unit.id] ?? ""} disabled={submitting} onChange={(value) => change(unit.id, value)} />
                ))}
              </div>
            );
          })}
        </section>
      ))}

      <div className="link-row">
        <button type="button" className="button-primary" onClick={confirmSubmit} disabled={submitting} aria-busy={submitting}>{labels.submit}</button>
      </div>
    </>
  );
}

/** The question exactly as printed (P-15): the catalogue crop, the transcript of a listening task and erratum notices. */
function PrintedQuestion({ question, lang }: { question: Question; lang: string }): ReactNode {
  const { dictionary } = useI18n();
  const labels = dictionary.practice;
  return (
    <>
      {question.transcript && (
        <details className="practice-transcript" open>
          <summary>{labels.transcript}</summary>
          <pre className="review-record__text" lang="de">{question.transcript}</pre>
        </details>
      )}
      {question.errata.length > 0 && <p className="notice practice-erratum" role="note">{labels.erratumNotice}</p>}
      {question.crop ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="question-crop" src={question.crop} alt={question.text} lang={lang} />
      ) : (
        <>
          <p className="notice">{labels.noCrop}</p>
          <pre className="review-record__text practice-question__text" lang={lang}>{question.text}</pre>
        </>
      )}
    </>
  );
}

function legendOf(unit: ExamUnit, labels: { item: string; answer: string; choose: string }): string {
  if (unit.item !== null) return labels.item.replace("{n}", String(unit.item));
  return unit.mode === "open" ? labels.answer : labels.choose;
}

function UnitInput({ unit, question, lang, value, disabled, onChange }: { unit: ExamUnit; question: Question | undefined; lang: string; value: string; disabled: boolean; onChange: (value: string) => void }): ReactNode {
  const { dictionary, locale } = useI18n();
  const labels = dictionary.practice;
  const examLabels = dictionary.exam;
  const item = question?.items.find((entry) => entry.item === unit.item) ?? question?.items[0];
  const legend = `${legendOf(unit, labels)} (${examLabels.pointsMax.replace("{p}", formatPoints(unit.maxPoints, locale))})`;
  const name = `unit-${unit.id}`;
  const optionText = (label: string) => question?.options.find((option) => option.label.toLowerCase() === label)?.text ?? null;

  return (
    <fieldset className="practice-item">
      <legend>{legend}</legend>
      {item?.text && unit.item !== null && <p className="practice-item__text" lang={lang}>{item.text}</p>}
      {unit.mode === "choice" && item && (
        <div className="practice-choices" role="radiogroup">
          {item.choices.map((choice) => (
            <label key={choice} className="practice-choice">
              <input type="radio" name={name} value={choice} checked={value === choice} disabled={disabled} onChange={() => onChange(choice)} />
              <span><strong>{choice})</strong>{optionText(choice) ? <span lang={lang}> {optionText(choice)}</span> : null}</span>
            </label>
          ))}
        </div>
      )}
      {unit.mode === "true_false" && (
        <div className="practice-choices" role="radiogroup">
          <label className="practice-choice"><input type="radio" name={name} value="r" checked={value === "r"} disabled={disabled} onChange={() => onChange("r")} /><span>{labels.true}</span></label>
          <label className="practice-choice"><input type="radio" name={name} value="f" checked={value === "f"} disabled={disabled} onChange={() => onChange("f")} /><span>{labels.false}</span></label>
        </div>
      )}
      {(unit.mode === "open" || (unit.mode === "choice" && !item)) && (
        <>
          <textarea name={name} aria-label={legend} maxLength={PRACTICE_RESPONSE_MAX_LENGTH} rows={4} disabled={disabled} lang={lang} value={value} onChange={(event) => onChange(event.target.value)} />
          <p className="form__hint">{unit.scoring === "matching" ? examLabels.matchingHint : examLabels.openHint}</p>
        </>
      )}
    </fieldset>
  );
}

function Result({ exam }: { exam: ExamView }): ReactNode {
  const { dictionary, locale } = useI18n();
  const labels = dictionary.exam;
  const practice = dictionary.practice;
  const lang = exam.subjectCode === "german" ? "de" : "bs";

  return (
    <>
      <section className="card" aria-labelledby="exam-result-title">
        <h2 id="exam-result-title">{labels.result}</h2>
        <p className="hub-stat__value">
          {labels.pointsOf.replace("{p}", formatPoints(exam.totalPoints ?? 0, locale)).replace("{max}", formatPoints(exam.maxPoints, locale))}
        </p>
        {exam.gradedAt && <p className="form__hint">{labels.gradedAt.replace("{date}", formatDateTime(exam.gradedAt, locale))}</p>}
        <p className="form__hint">{labels.resultNote}</p>
      </section>

      {groupByPosition(exam.units).map((position) => (
        <section key={position.position} className="card practice-question" aria-labelledby={`exam-result-${position.position}`}>
          <h2 id={`exam-result-${position.position}`}>{labels.task.replace("{n}", String(position.position))}</h2>
          {position.questions.map(({ questionVersionId, units }) => {
            const question = exam.questions[questionVersionId];
            return (
              <div key={questionVersionId} className="exam-question">
                {question && <PrintedQuestion question={question} lang={lang} />}
                <ul className="practice-feedback__items">
                  {units.map((unit) => (
                    <li key={unit.id}>
                      <strong>{legendOf(unit, practice)}: </strong>
                      <span>{labels.pointsOf.replace("{p}", formatPoints(unit.finalPoints ?? 0, locale)).replace("{max}", formatPoints(unit.maxPoints, locale))}</span>
                      {unit.correctPairs !== null && <span> ({labels.pairs.replace("{n}", String(unit.correctPairs))})</span>}
                      <br />
                      <span>{practice.yourAnswer}: </span><span lang={lang}>{unit.response.trim() || practice.empty_answer}</span>
                      {unit.solution && (
                        <>
                          <br />
                          <span>{practice.solution}: </span>
                          <pre className="review-record__text review-record__key" lang={lang}>{unit.solution}</pre>
                        </>
                      )}
                      {unit.note && <p className="form__hint">{labels.teacherNote.replace("{note}", unit.note)}</p>}
                    </li>
                  ))}
                </ul>
                {question && question.errataDetails.length > 0 && (
                  <section className="practice-erratum-details" aria-label={practice.erratumTitle}>
                    <h3>{practice.erratumTitle}</h3>
                    <ul>
                      {question.errataDetails.map((erratum, index) => (
                        <li key={index}>
                          {erratum.item !== null && <strong>{practice.item.replace("{n}", String(erratum.item))}: </strong>}
                          <span>{erratum.description}</span> <span className="form__hint">({erratum.evidence})</span>
                        </li>
                      ))}
                    </ul>
                    <p className="form__hint">{practice.erratumKeyStands}</p>
                  </section>
                )}
              </div>
            );
          })}
        </section>
      ))}
      <div className="link-row">
        <Link href={EXAM_PATH} className="button-secondary">{labels.backToExams}</Link>
      </div>
    </>
  );
}
