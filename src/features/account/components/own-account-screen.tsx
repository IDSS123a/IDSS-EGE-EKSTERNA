"use client";

import { useActionState, useRef, useEffect, type ReactNode } from "react";
import { APP_HOME_PATH } from "@/constants";
import { useI18n } from "@/features/localization/i18n-provider";
import { ReviewShell } from "@/features/review/components/review-shell";
import { changeOwnPasswordAction, type OwnPasswordResult } from "../actions";

/** Own account: every signed-in user changes their own password here (Sprint 06). */
export function OwnAccountScreen({ displayName, username, minLength }: { displayName: string; username: string; minLength: number }): ReactNode {
  const { dictionary } = useI18n();
  const labels = dictionary.ownAccount;
  const [result, formAction, pending] = useActionState<OwnPasswordResult | null, FormData>(changeOwnPasswordAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (result?.success) formRef.current?.reset();
  }, [result]);

  return (
    <ReviewShell backHref={APP_HOME_PATH} backLabel={dictionary.review.back} title={labels.title} subtitle={`${displayName}, ${username}`}>
      <section className="card" aria-labelledby="password-title">
        <h2 id="password-title">{labels.changePassword}</h2>
        <p>{labels.intro.replace("{min}", String(minLength))}</p>
        <form ref={formRef} action={formAction} className="form form--grid">
          <input type="text" name="username" autoComplete="username" value={username} readOnly hidden />
          <div className="form__field">
            <label htmlFor="currentPassword">{labels.current}</label>
            <input id="currentPassword" name="currentPassword" type="password" required maxLength={200} autoComplete="current-password" />
          </div>
          <div className="form__field">
            <label htmlFor="newPassword">{labels.new}</label>
            <input id="newPassword" name="newPassword" type="password" required minLength={minLength} maxLength={200} autoComplete="new-password" />
          </div>
          <div className="form__field">
            <label htmlFor="confirmPassword">{labels.confirm}</label>
            <input id="confirmPassword" name="confirmPassword" type="password" required minLength={minLength} maxLength={200} autoComplete="new-password" />
          </div>
          <div className="form__actions">
            <button type="submit" className="button-primary" disabled={pending} aria-busy={pending}>{pending ? labels.submitting : labels.submit}</button>
            <p className="action-feedback" aria-live="polite">
              {result?.success && <span className="action-feedback--ok">{labels.messages.PASSWORD_CHANGED}</span>}
              {result && !result.success && <span className="action-feedback--error">{labels.errors[result.code]}</span>}
            </p>
          </div>
        </form>
      </section>
    </ReviewShell>
  );
}
