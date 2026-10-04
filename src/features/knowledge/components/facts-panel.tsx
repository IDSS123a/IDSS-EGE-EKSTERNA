"use client";

import { useActionState, type ReactNode } from "react";
import type { CanonVersionStatus } from "@/features/canon/types";
import { useI18n } from "@/features/localization/i18n-provider";
import { loadCanonicalFactsAction } from "../actions";
import type { KnowledgeActionResult } from "../types";
import { useConfirmSubmit } from "@/features/shell/components/confirm-dialog";

/** What the server knows about the canonical facts of one catalogue version. */
export type FactsStatus = { available: boolean; loadedRules: number };

const LOADABLE: CanonVersionStatus[] = ["active", "validation_required"];

/**
 * Subject and exam rules of one catalogue version: how many are loaded and, for canon.publish,
 * the button that verifies the quotes and stores them. The server decides again.
 */
export function FactsPanel({ versionId, status, facts, canPublish }: { versionId: string; status: CanonVersionStatus; facts: FactsStatus; canPublish: boolean }): ReactNode {
  const { dictionary } = useI18n();
  const labels = dictionary.facts;
  const [result, formAction, pending] = useActionState<KnowledgeActionResult | null, FormData>(loadCanonicalFactsAction, null);
  const loaded = facts.loadedRules > 0 || result?.success === true;
  const confirmLoad = useConfirmSubmit(() => labels.confirm);
  if (!facts.available && !loaded) return null;


  return (
    <div className="ingestion-panel">
      <h4>{labels.title}</h4>
      <p>{labels.intro}</p>
      {facts.loadedRules > 0 && <p>{labels.loaded.replace("{rules}", String(facts.loadedRules))}</p>}
      {canPublish && !loaded && LOADABLE.includes(status) && (
        <form action={formAction} onSubmit={confirmLoad} className="inline-form">
          <input type="hidden" name="versionId" value={versionId} />
          <button type="submit" className="button-secondary" disabled={pending} aria-busy={pending}>
            {pending ? labels.running : labels.run}
          </button>
        </form>
      )}
      <p className="action-feedback" aria-live="polite">
        {result?.success && labels.messages.FACTS_LOADED.replace("{rules}", String(result.data.rules ?? 0))}
        {result && !result.success && <span className="action-feedback--error">{labels.errors[result.code]}{result.detail ? ` (${result.detail})` : ""}</span>}
      </p>
    </div>
  );
}
