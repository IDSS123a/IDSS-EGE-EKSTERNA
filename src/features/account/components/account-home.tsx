"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ACCOUNTS_PATH, CANON_PATH, REVIEW_PATH, SEARCH_PATH, SETTINGS_PATH } from "@/constants";
import { logoutAction } from "@/features/authentication/actions";
import type { CurrentAccount } from "@/features/authentication/types";
import { useI18n } from "@/features/localization/i18n-provider";
import { SiteHeader } from "@/features/shell/components/site-header";

/**
 * Signed-in landing page until role workspaces exist (Game Hub, Command Centers).
 * Receives only display fields already authorised on the server.
 */
export function AccountHome({
  account,
  canViewAccounts,
  canViewCanon,
  canOpenReview,
  canManageSettings,
}: {
  account: Pick<CurrentAccount, "displayName" | "role">;
  /** Decided on the server (lib/permissions.ts). */
  canViewAccounts: boolean;
  /** Decided on the server (lib/permissions.ts). */
  canViewCanon: boolean;
  canOpenReview: boolean;
  /** Decided on the server (lib/permissions.ts). */
  canManageSettings: boolean;
}): ReactNode {
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
        <p className="home__eyebrow">{dictionary.account.welcome}</p>
        <h1 className="home__title">{account.displayName}</h1>
        <p className="home__subtitle">
          {dictionary.account.roleLabel}: <strong>{dictionary.account.roles[account.role]}</strong>
        </p>
        <section className="card" aria-labelledby="next-steps">
          <h2 id="next-steps">{dictionary.account.nextStepsTitle}</h2>
          <p>{dictionary.account.nextStepsBody}</p>
          <div className="link-row">
            {canViewAccounts && <Link href={ACCOUNTS_PATH} className="button-primary">{dictionary.accounts.navLink}</Link>}
            {canViewCanon && <Link href={CANON_PATH} className="button-primary">{dictionary.canon.navLink}</Link>}
            {canOpenReview && <Link href={REVIEW_PATH} className="button-primary">{dictionary.review.navLink}</Link>}
            {canOpenReview && <Link href={SEARCH_PATH} className="button-primary">{dictionary.search.navLink}</Link>}
            {canManageSettings && <Link href={SETTINGS_PATH} className="button-primary">{dictionary.settings.navLink}</Link>}
          </div>
        </section>
      </main>
    </div>
  );
}
