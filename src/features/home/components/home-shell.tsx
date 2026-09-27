"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { LOGIN_PATH } from "@/constants";
import { useI18n } from "@/features/localization/i18n-provider";
import { SiteHeader } from "@/features/shell/components/site-header";
import { ReplaySplashButton } from "@/features/splash/components/replay-splash-button";

/**
 * Public entry page. A client component so every string follows the language switch
 * instantly (AMB-11). Contains no canonical exam content on purpose (CONSTITUTION P-3).
 */
export function HomeShell(): ReactNode {
  const { dictionary } = useI18n();

  return (
    <div className="page">
      <SiteHeader actions={<Link className="button-primary" href={LOGIN_PATH}>{dictionary.home.login}</Link>} />

      <main className="page__main">
        <p className="home__eyebrow">{dictionary.home.eyebrow}</p>
        <h1 className="home__title">{dictionary.home.title}</h1>
        <p className="home__subtitle">{dictionary.home.subtitle}</p>

        <section className="card" aria-labelledby="platform-status">
          <h2 id="platform-status">{dictionary.home.statusTitle}</h2>
          <p>{dictionary.home.statusBody}</p>
          <ReplaySplashButton />
        </section>
      </main>
    </div>
  );
}
