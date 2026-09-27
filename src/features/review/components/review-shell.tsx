"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAction } from "@/features/authentication/actions";
import { useI18n } from "@/features/localization/i18n-provider";
import { SiteHeader } from "@/features/shell/components/site-header";

/** Page frame of the review area: header with sign-out, back link, title. */
export function ReviewShell({ backHref, backLabel, title, subtitle, children }: { backHref: string; backLabel: string; title: string; subtitle?: string; children: ReactNode }): ReactNode {
  const { dictionary } = useI18n();
  return (
    <div className="page">
      <SiteHeader
        actions={
          <form action={logoutAction}>
            <button type="submit" className="button-secondary">{dictionary.account.logout}</button>
          </form>
        }
      />
      <main className="page__main">
        <Link href={backHref} className="back-link">{backLabel}</Link>
        <h1 className="home__title">{title}</h1>
        {subtitle && <p className="home__subtitle">{subtitle}</p>}
        {children}
      </main>
    </div>
  );
}
