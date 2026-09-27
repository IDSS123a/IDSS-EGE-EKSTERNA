"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/features/localization/i18n-provider";
import { SiteHeader } from "@/features/shell/components/site-header";

/** Loading state for every signed-in page (/app/*) while server data is read. */
export default function AppLoading(): ReactNode {
  const { dictionary } = useI18n();
  return (
    <div className="page">
      <SiteHeader />
      <main className="page__main" aria-busy="true">
        <section className="card">
          <p role="status">{dictionary.common.loading}</p>
        </section>
      </main>
    </div>
  );
}
