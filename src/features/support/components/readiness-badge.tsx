"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/features/localization/i18n-provider";
import { readinessPercent } from "../domain/indicators";
import type { Readiness } from "../types";

/** The IDSS readiness of one subject (PDL-032), always with its internal-indicator label in the title. */
export function ReadinessBadge({ readiness }: { readiness: Readiness }): ReactNode {
  const { dictionary } = useI18n();
  const labels = dictionary.support.readiness;
  const percent = readinessPercent(readiness);
  const text = percent !== null ? `${percent} %` : readiness.state === "below_80" ? labels.below80 : labels.notAvailable;
  return (
    <span className="status-pill" data-readiness={readiness.state} title={labels.hint.replace("{exams}", String(readiness.exams)).replace("{errors}", String(readiness.errors))}>
      {text}
    </span>
  );
}
