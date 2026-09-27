"use client";

import type { ReactNode } from "react";
import { APP_HOME_PATH } from "@/constants";
import { useI18n } from "@/features/localization/i18n-provider";
import { ReviewShell } from "@/features/review/components/review-shell";
import type { SplashShares } from "@/features/splash/palette";
import { SplashPaletteForm } from "./splash-palette-form";

/** Application settings (Superadmin, PDL-020). */
export function SettingsScreen({ palette }: { palette: SplashShares }): ReactNode {
  const { dictionary } = useI18n();
  return (
    <ReviewShell backHref={APP_HOME_PATH} backLabel={dictionary.review.back} title={dictionary.settings.title} subtitle={dictionary.settings.subtitle}>
      <SplashPaletteForm initial={palette} />
    </ReviewShell>
  );
}
