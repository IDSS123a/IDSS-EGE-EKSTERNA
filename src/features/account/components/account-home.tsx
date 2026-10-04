"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ACCOUNTS_PATH, ASSIGNMENTS_PATH, CANON_PATH, DIRECTOR_PATH, GRADING_PATH, GUIDE_PATH, OWN_ACCOUNT_PATH, REVIEW_PATH, SEARCH_PATH, SETTINGS_PATH, SUPPORT_PATH } from "@/constants";
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
  canGrade,
  canMonitor,
  canAssign,
  canDirect,
}: {
  account: Pick<CurrentAccount, "displayName" | "role">;
  /** Decided on the server (lib/permissions.ts). */
  canViewAccounts: boolean;
  /** Decided on the server (lib/permissions.ts). */
  canViewCanon: boolean;
  canOpenReview: boolean;
  /** Mock exam approval and grading (Sprint 07). */
  canGrade: boolean;
  /** Student monitoring and the daily summary: all subjects or the own subjects (Sprint 09). */
  canMonitor: boolean;
  /** Give assignments in the own subjects (PDL-035). */
  canAssign: boolean;
  /** Director Command Center (analytics.view_institution). */
  canDirect: boolean;
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
            {canDirect && <Link href={DIRECTOR_PATH} className="button-primary">{dictionary.director.navLink}</Link>}
            {canViewCanon && <Link href={CANON_PATH} className="button-primary">{dictionary.canon.navLink}</Link>}
            {canMonitor && <Link href={SUPPORT_PATH} className="button-primary">{dictionary.support.navLink}</Link>}
            {canMonitor && <Link href={`${SUPPORT_PATH}/dan`} className="button-primary">{dictionary.support.dailyLink}</Link>}
            {canAssign && <Link href={ASSIGNMENTS_PATH} className="button-primary">{dictionary.assignments.navLink}</Link>}
            {canGrade && <Link href={GRADING_PATH} className="button-primary">{dictionary.grading.navLink}</Link>}
            {canOpenReview && <Link href={REVIEW_PATH} className="button-primary">{dictionary.review.navLink}</Link>}
            {canOpenReview && <Link href={SEARCH_PATH} className="button-primary">{dictionary.search.navLink}</Link>}
            {canManageSettings && <Link href={SETTINGS_PATH} className="button-primary">{dictionary.settings.navLink}</Link>}
            <Link href={OWN_ACCOUNT_PATH} className="button-primary">{dictionary.ownAccount.navLink}</Link>
            <Link href={GUIDE_PATH} className="button-primary">{dictionary.guide.navLink}</Link>
          </div>
        </section>
      </main>
    </div>
  );
}
