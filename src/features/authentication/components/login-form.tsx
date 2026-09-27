"use client";

import Link from "next/link";
import { useActionState, type ReactNode } from "react";
import { useI18n } from "@/features/localization/i18n-provider";
import { SiteHeader } from "@/features/shell/components/site-header";
import { loginAction } from "../actions";
import type { LoginResult } from "../types";

/**
 * Username + password form (mandate §7A.5) driven by a Server Action with Zod validation
 * inside the action (E-3 accepted alternative for a two-field form). Error codes are mapped
 * to text on the client so the message follows the live language switch.
 */
export function LoginForm(): ReactNode {
  const { dictionary } = useI18n();
  const [state, formAction, pending] = useActionState<LoginResult | null, FormData>(loginAction, null);
  const errorCode = state && state.success === false ? state.code : null;
  const previousUsername = state && state.success === false ? state.username : undefined;

  return (
    <div className="page">
      <SiteHeader />
      <main className="page__main">
        <section className="card auth-card" aria-labelledby="login-title">
          <div className="auth-card__intro">
            <h1 id="login-title" className="auth-card__title">{dictionary.auth.title}</h1>
            <p className="auth-card__subtitle">{dictionary.auth.subtitle}</p>
            <Link href="/" className="auth-card__back">{dictionary.auth.backHome}</Link>
          </div>

          <form action={formAction} className="form" noValidate>
            <div className="form__field">
              <label htmlFor="username">{dictionary.auth.username}</label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                maxLength={120}
                defaultValue={previousUsername}
                aria-describedby="username-hint"
                aria-invalid={errorCode !== null}
              />
              <p id="username-hint" className="form__hint">{dictionary.auth.usernameHint}</p>
            </div>
            <div className="form__field">
              <label htmlFor="password">{dictionary.auth.password}</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                maxLength={200}
                aria-invalid={errorCode !== null}
              />
            </div>

            <p id="login-error" className="form__error" role="alert" aria-live="assertive">
              {errorCode ? dictionary.auth.errors[errorCode] : ""}
            </p>

            <button type="submit" className="button-primary button-block" disabled={pending} aria-busy={pending}>
              {pending ? dictionary.auth.submitting : dictionary.auth.submit}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
