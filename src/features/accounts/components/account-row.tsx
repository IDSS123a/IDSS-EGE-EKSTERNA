"use client";

import { useActionState, type ReactNode } from "react";
import { STAFF_PASSWORD_MIN_LENGTH, STUDENT_PASSWORD_MIN_LENGTH } from "@/constants";
import { useI18n } from "@/features/localization/i18n-provider";
import { GRANTABLE_BUNDLES, SETTABLE_STATUSES } from "@/lib/validation/schemas";
import { changeAccountStatusAction, changeBundleAction, resetPasswordAction } from "../actions";
import type { AccountActionResult, AccountSummary } from "../types";
import { ActionFeedback } from "./action-feedback";

type Props = {
  account: AccountSummary;
  /** The server decided whether this row may be changed (lib/permissions.ts canChangeAccount). */
  editable: boolean;
  canResetPassword: boolean;
  isSelf: boolean;
};

/** One account with its lifecycle, rights and password controls. */
export function AccountRow({ account, editable, canResetPassword, isSelf }: Props): ReactNode {
  const { dictionary } = useI18n();
  const labels = dictionary.accounts;
  const [statusResult, statusAction, statusPending] = useActionState<AccountActionResult | null, FormData>(changeAccountStatusAction, null);
  const [bundleResult, bundleAction, bundlePending] = useActionState<AccountActionResult | null, FormData>(changeBundleAction, null);
  const [passwordResult, passwordAction, passwordPending] = useActionState<AccountActionResult | null, FormData>(resetPasswordAction, null);
  const minLength = account.role === "student" ? STUDENT_PASSWORD_MIN_LENGTH : STAFF_PASSWORD_MIN_LENGTH;

  return (
    <li className="account-row" data-status={account.status}>
      <div className="account-row__identity">
        <strong>{account.displayName}</strong>
        <span className="account-row__username">{account.username}</span>
        <span className="account-row__meta">
          {dictionary.account.roles[account.role]}, <span className="status-pill" data-status={account.status}>{labels.statuses[account.status]}</span>
          {isSelf ? `, ${labels.you}` : ""}
        </span>
        {account.bundles.length > 0 && (
          <span className="account-row__bundles">
            {account.bundles.map((bundle) => labels.bundles[bundle as keyof typeof labels.bundles] ?? bundle).join(", ")}
          </span>
        )}
      </div>

      {editable ? (
        <div className="account-row__controls">
          <form action={statusAction} className="inline-form">
            <input type="hidden" name="userId" value={account.userId} />
            <label className="sr-only" htmlFor={`status-${account.userId}`}>{labels.setStatus}</label>
            <select id={`status-${account.userId}`} name="status" defaultValue={account.status === "invited" ? "active" : account.status}>
              {SETTABLE_STATUSES.map((status) => (
                <option key={status} value={status}>{labels.statuses[status]}</option>
              ))}
            </select>
            <button type="submit" className="button-secondary" disabled={statusPending}>{labels.apply}</button>
            <ActionFeedback result={statusResult} />
          </form>

          {account.role === "administrator" && (
            <div className="bundle-list">
              {GRANTABLE_BUNDLES.map((bundle) => {
                const granted = account.bundles.includes(bundle);
                return (
                  <form key={bundle} action={bundleAction} className="inline-form">
                    <input type="hidden" name="userId" value={account.userId} />
                    <input type="hidden" name="bundle" value={bundle} />
                    <input type="hidden" name="grant" value={granted ? "revoke" : "grant"} />
                    <button type="submit" className={granted ? "chip chip--on" : "chip"} disabled={bundlePending} aria-pressed={granted}>
                      {labels.bundles[bundle]}: {granted ? labels.revoke : labels.grant}
                    </button>
                  </form>
                );
              })}
              <ActionFeedback result={bundleResult} />
            </div>
          )}

          {canResetPassword && (
            <form action={passwordAction} className="inline-form">
              <input type="hidden" name="userId" value={account.userId} />
              <label className="sr-only" htmlFor={`password-${account.userId}`}>{labels.resetPassword}</label>
              <input id={`password-${account.userId}`} name="password" type="password" placeholder={labels.resetPassword} minLength={minLength} maxLength={200} autoComplete="new-password" />
              <button type="submit" className="button-secondary" disabled={passwordPending}>{labels.resetSubmit}</button>
              <ActionFeedback result={passwordResult} />
            </form>
          )}
        </div>
      ) : (
        <span className="account-row__locked">{isSelf ? labels.you : labels.protected}</span>
      )}
    </li>
  );
}
