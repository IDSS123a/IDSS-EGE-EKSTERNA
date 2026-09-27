"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/features/localization/i18n-provider";
import type { CanonActionResult, CanonErrorCode } from "../types";

/** Localised success/error line for a canon action (polite live region). */
export function CanonFeedback({ result }: { result: CanonActionResult | { success: false; code: CanonErrorCode } | null }): ReactNode {
  const { dictionary } = useI18n();
  if (!result) return <p className="action-feedback" aria-live="polite" />;
  return (
    <p className={`action-feedback ${result.success ? "action-feedback--ok" : "action-feedback--error"}`} aria-live="polite">
      {result.success ? dictionary.canon.messages[result.data.message] : dictionary.canon.errors[result.code]}
    </p>
  );
}
