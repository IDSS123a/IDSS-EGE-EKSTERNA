"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { APP_HOME_PATH } from "@/constants";
import { logoutAction } from "@/features/authentication/actions";
import { useI18n } from "@/features/localization/i18n-provider";
import { SiteHeader } from "@/features/shell/components/site-header";
import type { Subject } from "@/features/knowledge/types";
import type { AccountSummary } from "../types";
import { AccountRow } from "./account-row";
import { CreateAccountForm } from "./create-account-form";

type Props = {
  accounts: AccountSummary[];
  actorUserId: string;
  canManage: boolean;
  canResetPassword: boolean;
  /** userIds the server allows the actor to change. */
  editableUserIds: string[];
  subjects: Subject[];
};

/** Account administration (mandate §7A.2). All decisions arrive from the server; the UI only reflects them. */
export function AccountsScreen({ accounts, actorUserId, canManage, canResetPassword, editableUserIds, subjects }: Props): ReactNode {
  const { dictionary } = useI18n();
  const labels = dictionary.accounts;
  const editable = new Set(editableUserIds);

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
        <Link href={APP_HOME_PATH} className="back-link">{labels.back}</Link>
        <h1 className="home__title">{labels.title}</h1>
        <p className="home__subtitle">{labels.subtitle}</p>
        {canManage && <p className="notice">{labels.tokenNote}</p>}

        {canManage && <CreateAccountForm />}

        <section className="card" aria-labelledby="accounts-list-title">
          <h2 id="accounts-list-title">{labels.listTitle} ({accounts.length})</h2>
          {canManage && <p>{subjects.length > 0 ? labels.subjectTeacherNote : labels.noSubjects}</p>}
          {accounts.length <= 1 ? <p>{labels.empty}</p> : null}
          <ul className="account-list">
            {accounts.map((account) => (
              <AccountRow
                key={account.userId}
                account={account}
                editable={editable.has(account.userId)}
                canResetPassword={canResetPassword}
                isSelf={account.userId === actorUserId}
                subjects={subjects}
              />
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
