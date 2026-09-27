"use client";

import { useActionState, useState, type ReactNode } from "react";
import { STAFF_PASSWORD_MIN_LENGTH, STUDENT_PASSWORD_MIN_LENGTH } from "@/constants";
import { useI18n } from "@/features/localization/i18n-provider";
import { createAccountAction } from "../actions";
import type { AccountActionResult } from "../types";
import { ActionFeedback } from "./action-feedback";

/** Create an administrator or student account (Superadministrator only; enforced server-side). */
export function CreateAccountForm(): ReactNode {
  const { dictionary } = useI18n();
  const [role, setRole] = useState<"administrator" | "student">("student");
  const [result, formAction, pending] = useActionState<AccountActionResult | null, FormData>(createAccountAction, null);
  const minLength = role === "student" ? STUDENT_PASSWORD_MIN_LENGTH : STAFF_PASSWORD_MIN_LENGTH;

  return (
    <section className="card" aria-labelledby="create-account-title">
      <h2 id="create-account-title">{dictionary.accounts.createTitle}</h2>
      <form action={formAction} className="form form--grid" noValidate>
        <div className="form__field">
          <label htmlFor="new-role">{dictionary.accounts.role}</label>
          <select id="new-role" name="role" value={role} onChange={(event) => setRole(event.target.value === "administrator" ? "administrator" : "student")}>
            <option value="student">{dictionary.account.roles.student}</option>
            <option value="administrator">{dictionary.account.roles.administrator}</option>
          </select>
        </div>
        <div className="form__field">
          <label htmlFor="new-display-name">{dictionary.accounts.displayName}</label>
          <input id="new-display-name" name="displayName" type="text" required maxLength={160} autoComplete="off" />
        </div>
        <div className="form__field">
          <label htmlFor="new-username">{dictionary.accounts.username}</label>
          <input id="new-username" name="username" type="text" required maxLength={120} autoCapitalize="none" spellCheck={false} autoComplete="off" aria-describedby="new-username-hint" />
          <p id="new-username-hint" className="form__hint">
            {role === "administrator" ? dictionary.accounts.usernameHintStaff : dictionary.accounts.usernameHintStudent}
          </p>
        </div>
        <div className="form__field">
          <label htmlFor="new-password">{dictionary.accounts.password}</label>
          <input id="new-password" name="password" type="password" required minLength={minLength} maxLength={200} autoComplete="new-password" aria-describedby="new-password-hint" />
          <p id="new-password-hint" className="form__hint">{dictionary.accounts.passwordHint.replace("{min}", String(minLength))}</p>
        </div>
        <div className="form__actions">
          <button type="submit" className="button-primary" disabled={pending} aria-busy={pending}>
            {pending ? dictionary.accounts.creating : dictionary.accounts.create}
          </button>
          <ActionFeedback result={result} />
        </div>
      </form>
    </section>
  );
}
