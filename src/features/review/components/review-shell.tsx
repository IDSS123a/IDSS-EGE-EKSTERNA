"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAction } from "@/features/authentication/actions";
import { useI18n } from "@/features/localization/i18n-provider";
import { PrintButton, PrintHeader } from "@/features/shell/components/print-frame";
import { SiteHeader } from "@/features/shell/components/site-header";

/** Uniform IDSS print format of a page (PDL-036): letterhead on paper, one print button and an optional IDSS CSV export. */
export type PrintOptions = { confidential: boolean; exportHref?: string; exportLabel?: string };

/** Page frame of the review area: header with sign-out, back link, title; with `print`, the uniform IDSS print format. */
export function ReviewShell({ backHref, backLabel, title, subtitle, print, children }: { backHref: string; backLabel: string; title: string; subtitle?: string; print?: PrintOptions; children: ReactNode }): ReactNode {
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
      <main className={print ? "page__main page__main--printable" : "page__main"}>
        {print && <PrintHeader title={title} subtitle={subtitle} confidential={print.confidential} />}
        <Link href={backHref} className="back-link">{backLabel}</Link>
        <h1 className="home__title">{title}</h1>
        {subtitle && <p className="home__subtitle">{subtitle}</p>}
        {print && (
          <div className="link-row no-print print-toolbar">
            <PrintButton />
            {print.exportHref && <a className="button-secondary" href={print.exportHref}>{print.exportLabel ?? dictionary.print.export}</a>}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
