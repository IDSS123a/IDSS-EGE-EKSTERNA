"use client";

import Link from "next/link";
import { useActionState, type ReactNode } from "react";
import { REVIEW_PATH, REVIEW_REGION_MARGIN_POINTS, REVIEW_TEXT_MAX_LENGTH } from "@/constants";
import { formatDateTime } from "@/features/canon/components/format";
import { flagKey } from "@/features/ingestion/domain/report";
import type { SubjectCode } from "@/features/knowledge/types";
import { useI18n } from "@/features/localization/i18n-provider";
import { REVIEW_TASK_TYPES } from "@/lib/validation/schemas";
import { decideRecordAction, openFollowUpAction, recordErratumAction, resolveFollowUpAction, withdrawErratumAction } from "../actions";
import { regionOnPage } from "../domain/queue";
import type { AnswerKeyView, ErratumView, FollowUpView, QueueFilter, RecordForReview, ReviewActionResult, TrustedQuestionView } from "../types";
import { queueHref } from "./review-queue-screen";
import { ReviewShell } from "./review-shell";
import { SourceRegion } from "./source-region";
import { useConfirmSubmit } from "@/features/shell/components/confirm-dialog";

type Props = {
  review: RecordForReview;
  subjectCode: SubjectCode;
  sourceUrl: string;
  canDecide: boolean;
  filter: QueueFilter;
  previous: number | null;
  next: number | null;
};

/** One record beside its original page region, with the decision and, once accepted, errata and follow-ups (P-15). */
export function RecordReviewScreen({ review, subjectCode, sourceUrl, canDecide, filter, previous, next }: Props): ReactNode {
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
      {review.state === "accepted" && review.question && (
        <>
          <ErrataSection review={review} versionId={review.question.versionId} canEdit={review.current} />
          <FollowUpsSection review={review} versionId={review.question.versionId} canEdit={review.current} />
        </>
      )}
      {review.state === "accepted" && (
        <section className="card" aria-labelledby="keys-title">
          <h2 id="keys-title">{labels.keys.title}</h2>
          <p>{labels.decision.acceptedNote}</p>
          <p>{labels.keys.hint}</p>
          {review.answerKeys.length === 0 && <p>{labels.record.noKey}</p>}
          {review.answerKeys.map((key) => <KeyHistory key={key.id} answerKey={key} />)}
        </section>
      )}
      {review.state === "accepted" && review.question && review.question.revisions.length > 0 && (
        <TextHistory question={review.question} language={subjectCode === "german" ? "de" : "bs"} />
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

  const confirmAccept = useConfirmSubmit((submitter) => (submitter?.value === "accepted" ? labels.decision.confirmAccept : null));

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

/** Shared result line of the small forms on this screen. */
function Feedback({ result }: { result: ReviewActionResult | null }): ReactNode {
  const { dictionary } = useI18n();
  const labels = dictionary.review;
  return (
    <p className="action-feedback" aria-live="polite">
      {result?.success && <span className="action-feedback--ok">{labels.messages[result.data.message]}</span>}
      {result && !result.success && <span className="action-feedback--error">{labels.errors[result.code]}</span>}
    </p>
  );
}

/** Errata of the question (P-15): the printed task and key stay; students and teachers see the notice. */
function ErrataSection({ review, versionId, canEdit }: { review: RecordForReview; versionId: string; canEdit: boolean }): ReactNode {
  const { dictionary } = useI18n();
  const labels = dictionary.review;
  const [result, formAction, pending] = useActionState<ReviewActionResult | null, FormData>(recordErratumAction, null);
  const items = review.answerKeys.map((key) => key.itemNumber).filter((item): item is number => item !== null);
  const confirmSave = useConfirmSubmit(() => labels.errata.confirm);

  return (
    <section className="card" aria-labelledby="errata-title">
      <h2 id="errata-title">{labels.errata.title}</h2>
      <p>{labels.errata.hint}</p>
      {review.errata.length === 0 ? (
        <p>{labels.errata.none}</p>
      ) : (
        <ul className="canon-history__list">
          {review.errata.map((erratum) => (
            <ErratumEntry key={erratum.id} erratum={erratum} subjectId={review.subjectId} canEdit={canEdit} />
          ))}
        </ul>
      )}
      {canEdit && (
        <details className="review-text-details">
          <summary>{labels.errata.open}</summary>
          <form key={review.errata.length} action={formAction} onSubmit={confirmSave} className="form form--grid">
            <input type="hidden" name="questionVersionId" value={versionId} />
            <input type="hidden" name="subjectId" value={review.subjectId} />
            {items.length > 0 && (
              <div className="form__field">
                <label htmlFor="erratum-item">{labels.errata.item}</label>
                <select id="erratum-item" name="itemNumber" defaultValue="">
                  <option value="">{labels.errata.wholeTask}</option>
                  {items.map((item) => <option key={item} value={item}>{labels.record.item.replace("{n}", String(item))}</option>)}
                </select>
              </div>
            )}
            <div className="form__field">
              <label htmlFor="erratum-description">{labels.errata.description}</label>
              <textarea id="erratum-description" name="description" required maxLength={REVIEW_TEXT_MAX_LENGTH} rows={3} aria-describedby="erratum-description-hint" />
              <p id="erratum-description-hint" className="form__hint">{labels.errata.descriptionHint}</p>
            </div>
            <div className="form__field">
              <label htmlFor="erratum-evidence">{labels.errata.evidence}</label>
              <textarea id="erratum-evidence" name="evidence" required maxLength={REVIEW_TEXT_MAX_LENGTH} rows={2} />
            </div>
            <div className="form__actions">
              <button type="submit" className="button-primary" disabled={pending}>{labels.errata.submit}</button>
              <Feedback result={result} />
            </div>
          </form>
        </details>
      )}
    </section>
  );
}

function ErratumEntry({ erratum, subjectId, canEdit }: { erratum: ErratumView; subjectId: string; canEdit: boolean }): ReactNode {
  const { dictionary, locale } = useI18n();
  const labels = dictionary.review;
  const [result, formAction, pending] = useActionState<ReviewActionResult | null, FormData>(withdrawErratumAction, null);
  const by = (name: string | null, at: string) => labels.decision.by.replace("{name}", name ?? "").replace("{date}", formatDateTime(at, locale));

  return (
    <li>
      <span className="canon-history__event">
        {erratum.withdrawal ? labels.errata.withdrawn : labels.errata.active}
        {erratum.itemNumber !== null && `, ${labels.record.item.replace("{n}", String(erratum.itemNumber))}`}
      </span>
      <span lang="bs">{erratum.description}</span>
      <span lang="bs">{labels.errata.evidenceShown.replace("{text}", erratum.evidence)}</span>
      <span>{by(erratum.recordedByName, erratum.recordedAt)}</span>
      {erratum.withdrawal && (
        <span lang="bs">{labels.errata.withdrawalShown.replace("{text}", erratum.withdrawal.reason)} ({by(erratum.withdrawal.byName, erratum.withdrawal.at)})</span>
      )}
      {canEdit && !erratum.withdrawal && (
        <details className="review-text-details">
          <summary>{labels.errata.withdraw}</summary>
          <form action={formAction} className="form form--grid">
            <input type="hidden" name="erratumId" value={erratum.id} />
            <input type="hidden" name="subjectId" value={subjectId} />
            <div className="form__field">
              <label htmlFor={`withdraw-${erratum.id}`}>{labels.errata.withdrawReason}</label>
              <input id={`withdraw-${erratum.id}`} name="reason" required maxLength={REVIEW_TEXT_MAX_LENGTH} />
            </div>
            <div className="form__actions">
              <button type="submit" className="button-secondary" disabled={pending}>{labels.errata.withdrawSubmit}</button>
              <Feedback result={result} />
            </div>
          </form>
        </details>
      )}
    </li>
  );
}

/** Follow-ups: a provisional acceptance waits for a named person to check the question. */
function FollowUpsSection({ review, versionId, canEdit }: { review: RecordForReview; versionId: string; canEdit: boolean }): ReactNode {
  const { dictionary } = useI18n();
  const labels = dictionary.review;
  const [result, formAction, pending] = useActionState<ReviewActionResult | null, FormData>(openFollowUpAction, null);

  return (
    <section className="card" aria-labelledby="follow-ups-title">
      <h2 id="follow-ups-title">{labels.followUps.title}</h2>
      <p>{labels.followUps.hint}</p>
      {review.followUps.length === 0 ? (
        <p>{labels.followUps.none}</p>
      ) : (
        <ul className="canon-history__list">
          {review.followUps.map((followUp) => <FollowUpEntry key={followUp.id} followUp={followUp} subjectId={review.subjectId} canEdit={canEdit} />)}
        </ul>
      )}
      {canEdit && (
        <details className="review-text-details">
          <summary>{labels.followUps.open}</summary>
          <form key={review.followUps.length} action={formAction} className="form form--grid">
            <input type="hidden" name="questionVersionId" value={versionId} />
            <input type="hidden" name="subjectId" value={review.subjectId} />
            <div className="form__field">
              <label htmlFor="follow-up-assignee">{labels.followUps.assignee}</label>
              <input id="follow-up-assignee" name="assignee" required maxLength={200} />
            </div>
            <div className="form__field">
              <label htmlFor="follow-up-note">{labels.followUps.note}</label>
              <input id="follow-up-note" name="note" required maxLength={REVIEW_TEXT_MAX_LENGTH} />
            </div>
            <div className="form__actions">
              <button type="submit" className="button-secondary" disabled={pending}>{labels.followUps.submit}</button>
              <Feedback result={result} />
            </div>
          </form>
        </details>
      )}
    </section>
  );
}

function FollowUpEntry({ followUp, subjectId, canEdit }: { followUp: FollowUpView; subjectId: string; canEdit: boolean }): ReactNode {
  const { dictionary, locale } = useI18n();
  const labels = dictionary.review;
  const [result, formAction, pending] = useActionState<ReviewActionResult | null, FormData>(resolveFollowUpAction, null);
  const by = (name: string | null, at: string) => labels.decision.by.replace("{name}", name ?? "").replace("{date}", formatDateTime(at, locale));

  return (
    <li>
      <span className="canon-history__event">
        {followUp.resolution ? labels.followUps.resolved : labels.followUps.waiting.replace("{name}", followUp.assignee)}
      </span>
      <span lang="bs">{followUp.note}</span>
      <span>{by(followUp.openedByName, followUp.openedAt)}</span>
      {followUp.resolution && <span lang="bs">{followUp.resolution.note} ({by(followUp.resolution.byName, followUp.resolution.at)})</span>}
      {canEdit && !followUp.resolution && (
        <details className="review-text-details">
          <summary>{labels.followUps.resolve}</summary>
          <form action={formAction} className="form form--grid">
            <input type="hidden" name="followUpId" value={followUp.id} />
            <input type="hidden" name="subjectId" value={subjectId} />
            <div className="form__field">
              <label htmlFor={`resolve-${followUp.id}`}>{labels.followUps.resolutionNote}</label>
              <input id={`resolve-${followUp.id}`} name="note" required maxLength={REVIEW_TEXT_MAX_LENGTH} />
            </div>
            <div className="form__actions">
              <button type="submit" className="button-secondary" disabled={pending}>{labels.followUps.resolveSubmit}</button>
              <Feedback result={result} />
            </div>
          </form>
        </details>
      )}
    </li>
  );
}

/** The printed key (always the key, P-15) and earlier corrections, kept as history only. */
function KeyHistory({ answerKey }: { answerKey: AnswerKeyView }): ReactNode {
  const { dictionary, locale } = useI18n();
  const labels = dictionary.review;

  return (
    <div className="ingestion-panel">
      {answerKey.itemNumber !== null && <h4>{labels.record.item.replace("{n}", String(answerKey.itemNumber))}</h4>}
      <dl className="canon-version__meta">
        <div><dt>{labels.keys.printed}</dt><dd><pre className="review-record__key">{answerKey.printedAnswer}</pre></dd></div>
      </dl>
      {answerKey.revisions.length > 0 && (
        <>
          <p>{labels.keys.historyNote}</p>
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
        </>
      )}
    </div>
  );
}

/** Earlier text revisions (Sprint 06), history only: students see the printed catalogue page (P-15). */
function TextHistory({ question, language }: { question: TrustedQuestionView; language: string }): ReactNode {
  const { dictionary, locale } = useI18n();
  const labels = dictionary.review.text;
  const decision = dictionary.review.decision;

  return (
    <section className="card" aria-labelledby="text-title">
      <h2 id="text-title">{labels.title}</h2>
      <p>{labels.hint}</p>
      <ul className="canon-history__list">
        {question.revisions.map((revision) => (
          <li key={revision.createdAt}>
            <span lang="bs">{revision.reason}</span>
            {revision.evidence && <span lang="bs">{revision.evidence}</span>}
            <span>{decision.by.replace("{name}", revision.revisedByName ?? "").replace("{date}", formatDateTime(revision.createdAt, locale))}</span>
            <details>
              <summary>{labels.revised}</summary>
              <pre className="review-record__text" lang={language}>{revision.content.rawText}</pre>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
