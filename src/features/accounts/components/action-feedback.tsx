"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/features/localization/i18n-provider";
import type { AccountActionResult } from "../types";

/** Localised success/error line for an account action (polite live region). */
export function ActionFeedback({ result }: { result: AccountActionResult | null }): ReactNode {
  const { dictionary } = useI18n();
  if (!result) return <p className="action-feedback" aria-live="polite" />;
  return (
    <p className={`action-feedback ${result.success ? "action-feedback--ok" : "action-feedback--error"}`} aria-live="polite">
      {result.success ? dictionary.accounts.messages[result.data.message] : dictionary.accounts.errors[result.code]}
    </p>
  );
}
