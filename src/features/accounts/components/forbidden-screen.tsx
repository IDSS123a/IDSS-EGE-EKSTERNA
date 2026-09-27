"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { APP_HOME_PATH } from "@/constants";
import { useI18n } from "@/features/localization/i18n-provider";
import { SiteHeader } from "@/features/shell/components/site-header";

/** Shown when a signed-in account lacks the capability for a page (server decided). */
export function ForbiddenScreen(): ReactNode {
  const { dictionary } = useI18n();
  return (
    <div className="page">
      <SiteHeader />
      <main className="page__main page__main--narrow">
        <section className="card">
          <h1 className="auth-card__title">{dictionary.accounts.forbidden}</h1>
          <Link href={APP_HOME_PATH} className="auth-card__back">{dictionary.accounts.back}</Link>
        </section>
      </main>
    </div>
  );
}
