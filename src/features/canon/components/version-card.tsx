"use client";

import { useActionState, type FormEvent, type ReactNode } from "react";
import { CANON_PATH, CANON_REASON_MAX_LENGTH } from "@/constants";
import { useI18n } from "@/features/localization/i18n-provider";
import { transitionCanonVersionAction } from "../actions";
import { availableActions, requiresReason, shortHash } from "../domain";
import type { CanonActionResult, CanonVersion } from "../types";
import { CanonFeedback } from "./canon-feedback";
import { formatBytes, formatDateTime } from "./format";

/** One version of a canonical document: metadata, status, download and lifecycle actions. */
export function VersionCard({ version, canPublish }: { version: CanonVersion; canPublish: boolean }): ReactNode {
  const { dictionary, locale } = useI18n();
  const labels = dictionary.canon;
  const [result, formAction, pending] = useActionState<CanonActionResult | null, FormData>(transitionCanonVersionAction, null);
  const actions = canPublish ? availableActions(version.status) : [];
  const needsReason = actions.some(requiresReason);

  const confirmSubmit = (event: FormEvent<HTMLFormElement>): void => {
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const action = submitter?.value as keyof typeof labels.confirm | undefined;
    if (action && !window.confirm(labels.confirm[action])) event.preventDefault();
  };

  return (
    <li className="canon-version" data-status={version.status}>
      <div className="canon-version__head">
        <strong>{version.officialTitle}</strong>
        <span className="status-pill" data-status={version.status}>{labels.statuses[version.status]}</span>
      </div>
      <dl className="canon-version__meta">
        <div><dt>{labels.issuingAuthority}</dt><dd>{version.issuingAuthority}</dd></div>
        {version.referenceNumber && <div><dt>{labels.referenceNumber}</dt><dd>{version.referenceNumber}</dd></div>}
        {version.revisionLabel && <div><dt>{labels.revisionLabel}</dt><dd>{version.revisionLabel}</dd></div>}
        {version.publishedOn && <div><dt>{labels.publishedOn}</dt><dd>{version.publishedOn}</dd></div>}
        {version.effectiveFrom && <div><dt>{labels.effectiveFrom}</dt><dd>{version.effectiveFrom}</dd></div>}
        <div><dt>{labels.hash}</dt><dd><code title={version.sha256}>{shortHash(version.sha256)}</code></dd></div>
        <div><dt>{labels.size}</dt><dd>{formatBytes(version.byteSize, locale)}</dd></div>
        <div><dt>{labels.uploadedAt}</dt><dd>{formatDateTime(version.uploadedAt, locale)}</dd></div>
        {version.activatedAt && <div><dt>{labels.activatedAt}</dt><dd>{formatDateTime(version.activatedAt, locale)}</dd></div>}
      </dl>
      <p className="canon-version__dependents">
        {labels.dependents.replace("{current}", String(version.dependents.current)).replace("{stale}", String(version.dependents.stale))}
      </p>
      <div className="canon-version__controls">
        <a className="button-secondary" href={`${CANON_PATH}/preuzmi/${version.id}`}>{labels.download}</a>
        {actions.length > 0 && (
          <form action={formAction} onSubmit={confirmSubmit} className="inline-form canon-version__form">
            <input type="hidden" name="versionId" value={version.id} />
            {needsReason && (
              <>
                <label className="sr-only" htmlFor={`reason-${version.id}`}>{labels.reason}</label>
                <input id={`reason-${version.id}`} name="reason" maxLength={CANON_REASON_MAX_LENGTH} placeholder={labels.reason} aria-describedby={`reason-hint-${version.id}`} />
                <span id={`reason-hint-${version.id}`} className="sr-only">{labels.reasonHint}</span>
              </>
            )}
            {actions.map((action) => (
              <button key={action} type="submit" name="action" value={action} className={action === "activate" || action === "rollback" ? "button-primary" : "button-secondary"} disabled={pending}>
                {labels.actions[action]}
              </button>
            ))}
            <CanonFeedback result={result} />
          </form>
        )}
      </div>
    </li>
  );
}
