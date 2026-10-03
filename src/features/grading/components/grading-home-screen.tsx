"use client";

import Link from "next/link";
import { useActionState, type FormEvent, type ReactNode } from "react";
import { APP_HOME_PATH, GRADING_PATH, REVIEW_TEXT_MAX_LENGTH } from "@/constants";
import { formatDateTime } from "@/features/canon/components/format";
import { formatPoints } from "@/features/exams/domain/exam";
import { useI18n } from "@/features/localization/i18n-provider";
import { NotificationsPanel } from "@/features/notifications/components/notifications-panel";
import type { AppNotification } from "@/features/notifications/types";
import { ReviewShell } from "@/features/review/components/review-shell";
import { loadBlueprintAction, reviewBlueprintAction } from "../actions";
import { poolRange } from "../domain/blueprint";
import type { BlueprintContent, GradingActionResult, GradingQueueEntry, SubjectBlueprint } from "../types";

type Props = {
  blueprints: SubjectBlueprint[];
  queue: GradingQueueEntry[];
  /** Subject ids the teacher may review blueprints for, and whether they may load blueprints (canon.publish). */
  reviewable: string[];
  canLoad: boolean;
  notifications: AppNotification[];
  /** Practice answers waiting for the teacher (migration 021). */
  practiceWaiting: number;
};

/**
 * Teachers' mock exam area (Sprint 07): blueprints per subject (loaded from the repository, confirmed by a reviewer of
 * the subject against the canonical documents, P-15), sets waiting for approval, exams to grade and recent results.
 */
export function GradingHomeScreen({ blueprints, queue, reviewable, canLoad, notifications, practiceWaiting }: Props): ReactNode {
  const { dictionary } = useI18n();
  const labels = dictionary.grading;
  const groups: { key: "approval" | "grading" | "graded"; entries: GradingQueueEntry[] }[] = [
    { key: "approval", entries: queue.filter((entry) => entry.status === "awaiting_approval") },
    { key: "grading", entries: queue.filter((entry) => entry.status === "submitted") },
    { key: "graded", entries: queue.filter((entry) => entry.status === "graded") },
  ];

  return (
    <ReviewShell backHref={APP_HOME_PATH} backLabel={labels.back} title={labels.title} subtitle={labels.subtitle}>
      <NotificationsPanel notifications={notifications} />
      <div className="link-row">
        <Link href={`${GRADING_PATH}/vjezba`} className={practiceWaiting > 0 ? "button-primary" : "button-secondary"}>{labels.practice.link.replace("{n}", String(practiceWaiting))}</Link>
      </div>
      {groups.map((group) => (
        <section key={group.key} className="card" aria-labelledby={`grading-${group.key}`}>
          <h2 id={`grading-${group.key}`}>{labels.queue[group.key]} ({group.entries.length})</h2>
          {group.entries.length === 0 ? (
            <p>{labels.queue.empty}</p>
          ) : (
            <ul className="review-list">
              {group.entries.map((entry) => <QueueLine key={entry.id} entry={entry} />)}
            </ul>
          )}
        </section>
      ))}

      <h2 className="hub-section-title">{labels.blueprints.title}</h2>
      <p className="notice">{labels.blueprints.hint}</p>
      <div className="hub-subjects">
        {blueprints.map((blueprint) => (
          <BlueprintCard key={blueprint.subjectId} blueprint={blueprint} canReview={reviewable.includes(blueprint.subjectId)} canLoad={canLoad} />
        ))}
      </div>
    </ReviewShell>
  );
}

function QueueLine({ entry }: { entry: GradingQueueEntry }): ReactNode {
  const { dictionary, locale } = useI18n();
  const labels = dictionary.grading;
  const exam = dictionary.exam;
  const detail =
    entry.status === "graded" && entry.totalPoints !== null
      ? exam.pointsOf.replace("{p}", formatPoints(entry.totalPoints, locale)).replace("{max}", formatPoints(entry.maxPoints, locale))
      : entry.status === "submitted"
        ? labels.queue.ungraded.replace("{n}", String(entry.ungraded)).replace("{total}", String(entry.units))
        : exam.states[entry.status];
  return (
    <li>
      <Link href={`${GRADING_PATH}/${entry.id}`} className="review-list__item review-list__item--compact">
        <strong className="review-list__key">{entry.student}</strong>
        <span>{dictionary.subjects[entry.subjectCode]}</span>
        <span>{formatDateTime(entry.submittedAt ?? entry.createdAt, locale)}{entry.autoSubmitted ? `, ${labels.queue.auto}` : ""}</span>
        <span className="status-pill" data-exam={entry.status}>{detail}</span>
      </Link>
    </li>
  );
}

function BlueprintCard({ blueprint, canReview, canLoad }: { blueprint: SubjectBlueprint; canReview: boolean; canLoad: boolean }): ReactNode {
  const { dictionary, locale } = useI18n();
  const labels = dictionary.grading.blueprints;
  const [loadResult, loadAction, loading] = useActionState<GradingActionResult | null, FormData>(loadBlueprintAction, null);
  const { config, loaded } = blueprint;
  const latest = loaded?.reviews[0] ?? null;
  const outdated = config !== null && (loaded === null || loaded.sha256 !== config.sha256);
  const state = !loaded ? "none" : !latest ? "waiting" : latest.decision;

  return (
    <section className="card hub-subject" aria-labelledby={`blueprint-${blueprint.subjectCode}`}>
      <h3 id={`blueprint-${blueprint.subjectCode}`}>{dictionary.subjects[blueprint.subjectCode]}</h3>
      <p><span className="status-pill" data-review={state === "confirmed" ? "accepted" : state === "rejected" ? "returned" : "pending"}>{labels.states[state]}</span></p>
      {loaded && <p className="form__hint">{labels.loaded.replace("{version}", loaded.version).replace("{date}", formatDateTime(loaded.loadedAt, locale))}</p>}
      {latest && (
        <p className="form__hint">
          {labels.reviewed.replace("{name}", latest.reviewerName ?? "").replace("{date}", formatDateTime(latest.decidedAt, locale))}
          {latest.note ? `: ${latest.note}` : ""}
        </p>
      )}
      {loaded && <Positions content={loaded.content} />}
      {canReview && loaded && (latest ? (
        // A decision already exists: changing it is an exception, so the form stays folded.
        <details className="review-text-details">
          <summary>{labels.change}</summary>
          <ReviewForm blueprintId={loaded.id} subjectId={blueprint.subjectId} />
        </details>
      ) : (
        <ReviewForm blueprintId={loaded.id} subjectId={blueprint.subjectId} />
      ))}
      {canLoad && outdated && config && (
        <form action={loadAction} className="link-row">
          <input type="hidden" name="subjectCode" value={blueprint.subjectCode} />
          <button type="submit" className={loaded ? "button-secondary" : "button-primary"} disabled={loading}>
            {(loaded ? labels.loadNew : labels.load).replace("{version}", config.version)}
          </button>
        </form>
      )}
      <p aria-live="polite">
        {loadResult?.success && <span className="action-feedback--ok">{dictionary.grading.messages[loadResult.data.message]}</span>}
        {loadResult && !loadResult.success && <span className="action-feedback--error">{dictionary.grading.errors[loadResult.code]}</span>}
      </p>
      {!config && <p className="form__hint">{labels.noConfig}</p>}
    </section>
  );
}

/** The blueprint as reviewers compare it with the official tests and the catalogue: positions, points and ranges. */
function Positions({ content }: { content: BlueprintContent }): ReactNode {
  const { dictionary, locale } = useI18n();
  const labels = dictionary.grading.blueprints;
  const total = content.positions.reduce((sum, position) => sum + position.points, 0);
  return (
    <details>
      <summary>{labels.details.replace("{n}", String(content.positions.length)).replace("{points}", formatPoints(total, locale))}</summary>
      <p className="form__hint">{labels.checker.replace("{name}", content.reviewer)}</p>
      <p className="form__hint">{labels.evidence.replace("{text}", content.evidence)}</p>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr><th>{labels.columns.position}</th><th>{labels.columns.format}</th><th>{labels.columns.points}</th><th>{labels.columns.pool}</th></tr>
          </thead>
          <tbody>
            {content.positions.map((position) => (
              <tr key={position.position}>
                <td>{position.position}{position.label ? ` ${position.label}` : ""}</td>
                <td>{labels.formats[position.format as keyof typeof labels.formats] ?? position.format}</td>
                <td>
                  {formatPoints(position.points, locale)}
                  {position.items && position.item_points ? ` (${position.items} x ${formatPoints(position.item_points, locale)})` : ""}
                  {position.part_points ? ` (${labels.parts.replace("{p}", formatPoints(position.part_points, locale))})` : ""}
                </td>
                <td>
                  {position.pool.map((pool) => {
                    const range = poolRange(pool);
                    return <span key={pool.key + pool.from} className="blueprint-pool">{labels.range.replace("{first}", range.first).replace("{last}", range.last)}</span>;
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function ReviewForm({ blueprintId, subjectId }: { blueprintId: string; subjectId: string }): ReactNode {
  const { dictionary } = useI18n();
  const labels = dictionary.grading.blueprints;
  const [result, formAction, pending] = useActionState<GradingActionResult | null, FormData>(reviewBlueprintAction, null);
  const confirmChoice = (event: FormEvent<HTMLFormElement>): void => {
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.value === "confirmed" && !window.confirm(labels.confirmQuestion)) event.preventDefault();
  };
  return (
    <form action={formAction} onSubmit={confirmChoice} className="form">
      <input type="hidden" name="blueprintId" value={blueprintId} />
      <input type="hidden" name="subjectId" value={subjectId} />
      <div className="form__field">
        <label htmlFor={`blueprint-note-${blueprintId}`}>{labels.note}</label>
        <input id={`blueprint-note-${blueprintId}`} name="note" maxLength={REVIEW_TEXT_MAX_LENGTH} />
      </div>
      <div className="form__actions">
        <button type="submit" name="decision" value="confirmed" className="button-primary" disabled={pending}>{labels.confirm}</button>
        <button type="submit" name="decision" value="rejected" className="button-secondary" disabled={pending}>{labels.reject}</button>
        <p className="action-feedback" aria-live="polite">
          {result?.success && <span className="action-feedback--ok">{dictionary.grading.messages[result.data.message]}</span>}
          {result && !result.success && <span className="action-feedback--error">{dictionary.grading.errors[result.code]}</span>}
        </p>
      </div>
    </form>
  );
}
