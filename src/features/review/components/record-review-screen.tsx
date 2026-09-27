"use client";

import Link from "next/link";
import { useActionState, type FormEvent, type ReactNode } from "react";
import { REVIEW_PATH, REVIEW_REGION_MARGIN_POINTS, REVIEW_TEXT_MAX_LENGTH } from "@/constants";
import { formatDateTime } from "@/features/canon/components/format";
import { flagKey } from "@/features/ingestion/domain/report";
import type { SubjectCode } from "@/features/knowledge/types";
import { useI18n } from "@/features/localization/i18n-provider";
import { REVIEW_TASK_TYPES } from "@/lib/validation/schemas";
import { decideRecordAction, proposeKeyRevisionAction } from "../actions";
import { regionOnPage } from "../domain/queue";
import type { AnswerKeyView, QueueFilter, RecordForReview, ReviewActionResult } from "../types";
import { queueHref } from "./review-queue-screen";
import { ReviewShell } from "./review-shell";
import { SourceRegion } from "./source-region";

type Props = {
  review: RecordForReview;
  subjectCode: SubjectCode;
  sourceUrl: string;
  canDecide: boolean;
  canRevise: boolean;
  filter: QueueFilter;
  previous: number | null;
  next: number | null;
};

/** One record beside its original page region, with the decision and, once accepted, key revisions. */
export function RecordReviewScreen({ review, subjectCode, sourceUrl, canDecide, canRevise, filter, previous, next }: Props): ReactNode {
  const { dictionary, locale } = useI18n();
  const labels = dictionary.review;
  const { record } = review;
  const recordHref = (id: number) => `${REVIEW_PATH}/${id}?prikaz=${filter}`;

  return (
    <ReviewShell backHref={queueHref(subjectCode, filter)} backLabel={labels.record.backToQueue} title={review.recordKey} subtitle={dictionary.subjects[subjectCode]}>
      <nav className="review-pager" aria-label={labels.record.backToQueue}>
        {previous ? <Link className="button-secondary" href={recordHref(previous)}>{labels.record.previous}</Link> : <span />}
        <span className="status-pill" data-review={review.state}>{labels.states[review.state]}</span>
        {next ? <Link className="button-secondary" href={recordHref(next)}>{labels.record.next}</Link> : <span />}
      </nav>
      {!review.current && <p className="notice">{labels.record.readOnly}</p>}

      <div className="review-record">
        <section className="card review-record__source" aria-label={labels.source.page.replace("{page}", record.source.pages.join(", "))}>
          <p className="notice">{labels.record.compareHint}</p>
          {record.source.pages.map((page) => (
            <SourceRegion
              key={page}
              sourceUrl={sourceUrl}
              page={page}
              region={regionOnPage(record.source.regions, page, REVIEW_REGION_MARGIN_POINTS)}
              label={labels.source.alt.replace("{key}", review.recordKey)}
            />
          ))}
        </section>

        <section className="card review-record__extracted" aria-labelledby="extracted-title">
          <h2 id="extracted-title">{labels.record.extracted}</h2>
          <dl className="canon-version__meta">
            <div><dt>{labels.record.area}</dt><dd>{record.semantics.area ?? ""}</dd></div>
            {record.semantics.catalogue_level && <div><dt>{labels.record.level}</dt><dd>{record.semantics.catalogue_level}</dd></div>}
            <div><dt>{labels.record.pages}</dt><dd>{record.source.pages.join(", ")}</dd></div>
            <div><dt>{labels.columns.structure}</dt><dd>{labels.structural[review.structuralStatus]}</dd></div>
          </dl>
          {/* Canonical text stays in its source language and is shown verbatim (AMB-13, P-13 exempt). */}
          <pre className="review-record__text" lang={subjectCode === "german" ? "de" : "bs"}>{record.syntax.raw_text}</pre>
          {record.stimulus && (
            <details>
              <summary>{labels.record.transcript}</summary>
              <pre className="review-record__text" lang="de">{record.stimulus.transcript_raw_text}</pre>
            </details>
          )}
          {record.validation.issues.length > 0 && (
            <>
              <h3>{labels.record.flags}</h3>
              <ul className="ingestion-panel__flags">
                {record.validation.issues.map((issue) => <li key={issue}>{dictionary.ingestion.flagTexts[flagKey(issue)]}</li>)}
              </ul>
            </>
          )}
          <h3>{labels.record.printedKey}</h3>
          <PrintedKey review={review} />

          <h3>{labels.record.history}</h3>
          {review.history.length === 0 ? (
            <p>{labels.record.noHistory}</p>
          ) : (
            <ul className="canon-history__list">
              {review.history.map((entry) => (
                <li key={entry.decidedAt}>
                  <span className="canon-history__event">{labels.states[entry.decision]}</span>
                  {entry.taskType && <span>{labels.taskTypes[entry.taskType as keyof typeof labels.taskTypes] ?? entry.taskType}</span>}
                  {entry.reason && <span lang="bs">{entry.reason}</span>}
                  <span>{labels.decision.by.replace("{name}", entry.reviewerName ?? "").replace("{date}", formatDateTime(entry.decidedAt, locale))}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {canDecide && review.state !== "accepted" && <DecisionForm review={review} />}
      {review.state === "accepted" && (
        <section className="card" aria-labelledby="keys-title">
          <h2 id="keys-title">{labels.keys.title}</h2>
          <p>{labels.decision.acceptedNote}</p>
          <p>{labels.keys.hint}</p>
          {review.answerKeys.length === 0 && <p>{labels.record.noKey}</p>}
          {review.answerKeys.map((key) => <KeyRevisions key={key.id} answerKey={key} subjectId={review.subjectId} canRevise={canRevise} />)}
        </section>
      )}
    </ReviewShell>
  );
}

/** The key as printed in the catalogue section of solutions (per scored item for German tasks). */
function PrintedKey({ review }: { review: RecordForReview }): ReactNode {
  const { dictionary } = useI18n();
  const labels = dictionary.review.record;
  const items = review.record.logic.scored_items ?? [];
  if (items.length > 0) {
    return (
      <ul className="review-keys">
        {items.map((item) => (
          <li key={item.item_number}>
            {labels.item.replace("{n}", String(item.item_number))}: <strong lang="de">{item.answer_key_raw ?? ""}</strong>
          </li>
        ))}
      </ul>
    );
  }
  const key = review.record.logic.answer_key_raw;
  return key ? <pre className="review-record__text review-record__key">{key}</pre> : <p>{labels.noKey}</p>;
}

function DecisionForm({ review }: { review: RecordForReview }): ReactNode {
  const { dictionary } = useI18n();
  const labels = dictionary.review;
  const [result, formAction, pending] = useActionState<ReviewActionResult | null, FormData>(decideRecordAction, null);
  const extractedType = review.record.logic.task_type;
  const defaultType = REVIEW_TASK_TYPES.find((type) => type === extractedType) ?? "";
  const canAccept = review.structuralStatus !== "failed";

  const confirmAccept = (event: FormEvent<HTMLFormElement>): void => {
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.value === "accepted" && !window.confirm(labels.decision.confirmAccept)) event.preventDefault();
  };

  return (
    <section className="card" aria-labelledby="decision-title">
      <h2 id="decision-title">{labels.decision.title}</h2>
      <form action={formAction} onSubmit={confirmAccept} className="form form--grid">
        <input type="hidden" name="recordId" value={review.recordId} />
        <input type="hidden" name="subjectId" value={review.subjectId} />
        <div className="form__field">
          <label htmlFor="taskType">{labels.decision.taskType}</label>
          <select id="taskType" name="taskType" defaultValue={defaultType}>
            <option value="" />
            {REVIEW_TASK_TYPES.map((type) => <option key={type} value={type}>{labels.taskTypes[type]}</option>)}
          </select>
        </div>
        <div className="form__field">
          <label htmlFor="reason">{labels.decision.reason}</label>
          <input id="reason" name="reason" maxLength={REVIEW_TEXT_MAX_LENGTH} aria-describedby="reason-hint" />
          <p id="reason-hint" className="form__hint">{labels.decision.reasonHint}</p>
        </div>
        <div className="form__actions">
          {canAccept && <button type="submit" name="decision" value="accepted" className="button-primary" disabled={pending}>{labels.decision.accept}</button>}
          <button type="submit" name="decision" value="returned" className="button-secondary" disabled={pending}>{labels.decision.return}</button>
          <p className="action-feedback" aria-live="polite">
            {result?.success && <span className="action-feedback--ok">{labels.messages[result.data.message]}</span>}
            {result && !result.success && <span className="action-feedback--error">{labels.errors[result.code]}</span>}
          </p>
        </div>
      </form>
    </section>
  );
}

function KeyRevisions({ answerKey, subjectId, canRevise }: { answerKey: AnswerKeyView; subjectId: string; canRevise: boolean }): ReactNode {
  const { dictionary, locale } = useI18n();
  const labels = dictionary.review;
  const [result, formAction, pending] = useActionState<ReviewActionResult | null, FormData>(proposeKeyRevisionAction, null);
  const effective = answerKey.revisions[0]?.correctedAnswer ?? answerKey.printedAnswer;
  const fieldId = (name: string) => `${name}-${answerKey.id}`;

  return (
    <div className="ingestion-panel">
      {answerKey.itemNumber !== null && <h4>{labels.record.item.replace("{n}", String(answerKey.itemNumber))}</h4>}
      <dl className="canon-version__meta">
        <div><dt>{labels.keys.printed}</dt><dd><pre className="review-record__key">{answerKey.printedAnswer}</pre></dd></div>
        <div><dt>{labels.keys.effective}</dt><dd><pre className="review-record__key">{effective}</pre></dd></div>
      </dl>
      {answerKey.revisions.length > 0 && (
        <ul className="canon-history__list">
          {answerKey.revisions.map((revision) => (
            <li key={revision.createdAt}>
              <span className="canon-history__event">{revision.correctedAnswer}</span>
              <span>{revision.reason}</span>
              {revision.evidence && <span>{revision.evidence}</span>}
              <span>{labels.decision.by.replace("{name}", revision.proposedByName ?? "").replace("{date}", formatDateTime(revision.createdAt, locale))}</span>
            </li>
          ))}
        </ul>
      )}
      {canRevise && (
        <form action={formAction} className="form form--grid">
          <input type="hidden" name="answerKeyId" value={answerKey.id} />
          <input type="hidden" name="subjectId" value={subjectId} />
          <div className="form__field">
            <label htmlFor={fieldId("corrected")}>{labels.keys.corrected}</label>
            <input id={fieldId("corrected")} name="correctedAnswer" required maxLength={REVIEW_TEXT_MAX_LENGTH} />
          </div>
          <div className="form__field">
            <label htmlFor={fieldId("reason")}>{labels.keys.reason}</label>
            <input id={fieldId("reason")} name="reason" required maxLength={REVIEW_TEXT_MAX_LENGTH} />
          </div>
          <div className="form__field">
            <label htmlFor={fieldId("evidence")}>{labels.keys.evidence}</label>
            <input id={fieldId("evidence")} name="evidence" maxLength={REVIEW_TEXT_MAX_LENGTH} />
          </div>
          <div className="form__actions">
            <button type="submit" className="button-secondary" disabled={pending}>{labels.keys.submit}</button>
            <p className="action-feedback" aria-live="polite">
              {result?.success && <span className="action-feedback--ok">{labels.messages[result.data.message]}</span>}
              {result && !result.success && <span className="action-feedback--error">{labels.errors[result.code]}</span>}
            </p>
          </div>
        </form>
      )}
    </div>
  );
}
