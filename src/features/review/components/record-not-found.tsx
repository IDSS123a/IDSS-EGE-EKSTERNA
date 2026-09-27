"use client";

import type { ReactNode } from "react";
import { REVIEW_PATH } from "@/constants";
import { useI18n } from "@/features/localization/i18n-provider";
import { ReviewShell } from "./review-shell";

/** A record that does not exist or is outside the reviewer's subjects (same answer for both). */
export function RecordNotFound(): ReactNode {
  const { dictionary } = useI18n();
  return (
    <ReviewShell backHref={REVIEW_PATH} backLabel={dictionary.review.record.backToQueue} title={dictionary.review.title}>
      <p className="notice">{dictionary.review.record.notFound}</p>
    </ReviewShell>
  );
}
