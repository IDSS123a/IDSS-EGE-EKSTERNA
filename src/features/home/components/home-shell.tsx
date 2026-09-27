"use client";

import type { ReactNode } from "react";
import { BRAND_LOGO_HEIGHT_PX, BRAND_LOGO_PATH, BRAND_LOGO_WIDTH_PX } from "@/constants";
import { useI18n } from "@/features/localization/i18n-provider";
import { LanguageSwitcher } from "@/features/localization/language-switcher";
import { ReplaySplashButton } from "@/features/splash/components/replay-splash-button";

/**
 * Temporary entry page until authentication lands (Sprint 01). A client component so
 * every string follows the language switch instantly (AMB-11). Contains no canonical
 * exam content on purpose (CONSTITUTION P-3).
 */
export function HomeShell(): ReactNode {
  const { dictionary } = useI18n();

  return (
    <div className="home">
      <header className="home__header">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="home__logo"
          src={BRAND_LOGO_PATH}
          alt={dictionary.splash.logoAlt}
          width={BRAND_LOGO_WIDTH_PX}
          height={BRAND_LOGO_HEIGHT_PX}
        />
        <LanguageSwitcher />
      </header>

      <main className="home__main">
        <p className="home__eyebrow">{dictionary.home.eyebrow}</p>
        <h1 className="home__title">{dictionary.home.title}</h1>
        <p className="home__subtitle">{dictionary.home.subtitle}</p>

        <section className="home__status" aria-labelledby="platform-status">
          <h2 id="platform-status">{dictionary.home.statusTitle}</h2>
          <p>{dictionary.home.statusBody}</p>
          <ReplaySplashButton />
        </section>
      </main>
    </div>
  );
}
