"use client";

import type { ReactNode } from "react";
import { APP_HOME_PATH } from "@/constants";
import { useI18n } from "@/features/localization/i18n-provider";
import { ReviewShell } from "@/features/review/components/review-shell";
import type { SplashShares } from "@/features/splash/palette";
import { AppSettingsForms } from "./app-settings-forms";
import { SplashPaletteForm } from "./splash-palette-form";

/** Application settings (Superadmin): the Director's values (PDL-040 K5) and the splash colours (PDL-020). */
export function SettingsScreen({ palette, app }: { palette: SplashShares; app: Parameters<typeof AppSettingsForms>[0] }): ReactNode {
  const { dictionary } = useI18n();
  return (
    <ReviewShell backHref={APP_HOME_PATH} backLabel={dictionary.review.back} title={dictionary.settings.title} subtitle={dictionary.settings.subtitle}>
      <AppSettingsForms {...app} />
      <SplashPaletteForm initial={palette} />
    </ReviewShell>
  );
}
