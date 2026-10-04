"use client";

import { useActionState, type ReactNode } from "react";
import { formatDateTime } from "@/features/canon/components/format";
import type { CanonVersionStatus } from "@/features/canon/types";
import { useI18n } from "@/features/localization/i18n-provider";
import { runIngestionAction } from "../actions";
import { groupFlags } from "../domain/report";
import type { IngestionJobSummary } from "../repository";
import type { IngestionActionResult, IngestionErrorCode } from "../types";
import { useConfirmSubmit } from "@/features/shell/components/confirm-dialog";

const INGESTIBLE: CanonVersionStatus[] = ["active", "validation_required"];

/**
 * Question extraction of one document version: the latest job (counts, review notes, or why it
 * failed) and, for canon.publish, the button to run it. Server-side checks decide again.
 */
export function IngestionPanel({ versionId, status, job, canPublish }: { versionId: string; status: CanonVersionStatus; job: IngestionJobSummary | null; canPublish: boolean }): ReactNode {
  const { dictionary, locale } = useI18n();
  const labels = dictionary.ingestion;
  const [result, formAction, pending] = useActionState<IngestionActionResult | null, FormData>(runIngestionAction, null);
  const confirmRun = useConfirmSubmit(() => labels.confirm);
  if (!INGESTIBLE.includes(status) && !job) return null;

  const counts = job?.counts ?? {};
  const rows: [string, number | undefined][] = [
    [labels.units, counts.units],
    [labels.scoredUnits, counts.scored_units],
    [labels.passed, counts.passed],
    [labels.flagged, counts.passed_with_flags],
    [labels.structuralFailed, counts.failed],
    [labels.withKey, counts.with_answer_key],
    [labels.supplementary, counts.supplementary],
  ];
  const matches = job?.report.declared_total_matches;

  return (
    <div className="ingestion-panel">
      <h4>{labels.title}</h4>
      {!job && <p>{labels.none}</p>}
      {job && (
        <>
          <p>
            {labels.lastRun}: <time dateTime={job.finishedAt}>{formatDateTime(job.finishedAt, locale)}</time>,{" "}
            <strong className="status-pill" data-status={job.state === "succeeded" ? "active" : "rejected"}>{job.state === "succeeded" ? labels.succeeded : labels.failed}</strong>
          </p>
          {job.state === "failed" && job.failureCode && <p className="action-feedback--error">{labels.errors[job.failureCode as IngestionErrorCode] ?? job.failureCode}</p>}
          {job.state === "succeeded" && (
            <>
              <dl className="ingestion-panel__counts">
                {rows.filter(([, value]) => value !== undefined).map(([label, value]) => (
                  <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
                ))}
              </dl>
              {matches !== null && matches !== undefined && <p>{matches ? labels.declaredMatch : labels.declaredMismatch}</p>}
              {job.report.flag_counts && Object.keys(job.report.flag_counts).length > 0 && (
                <details>
                  <summary>{labels.flags}</summary>
                  <ul className="ingestion-panel__flags">
                    {groupFlags(job.report.flag_counts).map(([key, count]) => (
                      <li key={key}>{count} × {labels.flagTexts[key]}</li>
                    ))}
                  </ul>
                </details>
              )}
              <p className="notice">{labels.untrusted}</p>
            </>
          )}
        </>
      )}
      {canPublish && INGESTIBLE.includes(status) && (
        <form action={formAction} onSubmit={confirmRun} className="inline-form">
          <input type="hidden" name="versionId" value={versionId} />
          <button type="submit" className="button-secondary" disabled={pending} aria-busy={pending}>
            {pending ? labels.running : job ? labels.rerun : labels.run}
          </button>
          <p className="action-feedback" aria-live="polite">
            {result?.success && labels.messages.INGESTED.replace("{units}", String(result.data.units)).replace("{scored}", String(result.data.scoredUnits))}
            {result && !result.success && <span className="action-feedback--error">{labels.errors[result.code]}</span>}
          </p>
        </form>
      )}
    </div>
  );
}
