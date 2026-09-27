"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/features/localization/i18n-provider";

/** Reloads the page so the first-paint splash can be reviewed again. */
export function ReplaySplashButton(): ReactNode {
  const { dictionary } = useI18n();
  return (
    <button type="button" className="button-secondary" onClick={() => window.location.reload()}>
      {dictionary.home.replaySplash}
    </button>
  );
}
