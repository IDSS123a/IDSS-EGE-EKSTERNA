"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { APP_HOME_PATH } from "@/constants";
import { useI18n } from "@/features/localization/i18n-provider";
import { SiteHeader } from "@/features/shell/components/site-header";

/**
 * Error boundary for every signed-in page (/app/*). The user sees a friendly, localised message
 * and a retry; the technical error is already logged on the server with its location (the
 * production `error.message` is generic by design, only `digest` links it to the server log).
 */
export default function AppError({ retry }: { error: Error & { digest?: string }; retry: () => void }): ReactNode {
  const { dictionary } = useI18n();
  return (
    <div className="page">
      <SiteHeader />
      <main className="page__main">
        <section className="card" role="alert">
          <h1 className="auth-card__title">{dictionary.common.errorTitle}</h1>
          <p>{dictionary.common.errorBody}</p>
          <div className="link-row">
            <button type="button" className="button-primary" onClick={() => retry()}>{dictionary.common.retry}</button>
            <Link href={APP_HOME_PATH} className="button-secondary">{dictionary.accounts.back}</Link>
          </div>
        </section>
      </main>
    </div>
  );
}
