"use client";

import type { ReactNode } from "react";
import { CONTACT_EMAIL, type LEGAL_DOCUMENTS } from "@/constants";
import { useI18n } from "@/features/localization/i18n-provider";
import { ReviewShell } from "@/features/review/components/review-shell";

type DocumentKey = (typeof LEGAL_DOCUMENTS)[number]["key"];

/**
 * A legal document page. The texts are written and approved by IDSS, never generated (AMB-20); until they
 * arrive the page says so and gives the contact.
 */
export function LegalDocument({ documentKey }: { documentKey: DocumentKey }): ReactNode {
  const { dictionary } = useI18n();
  const labels = dictionary.footer;
  const [before, after] = labels.contact.split("{email}");
  return (
    <ReviewShell backHref="/" backLabel={labels.back} title={labels[documentKey]}>
      <section className="card">
        <p>{labels.pending}</p>
        <p>
          {before}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          {after}
        </p>
      </section>
    </ReviewShell>
  );
}
