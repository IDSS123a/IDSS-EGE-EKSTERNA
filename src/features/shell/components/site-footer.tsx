"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { CONTACT_EMAIL, LEGAL_DOCUMENTS } from "@/constants";
import { useI18n } from "@/features/localization/i18n-provider";

/** Footer on every page, bottom left: legal documents and the product line (Director, 2026-09-27). */
export function SiteFooter(): ReactNode {
  const { dictionary } = useI18n();
  const labels = dictionary.footer;
  const [before, after] = labels.product.split("{email}");
  return (
    <footer className="site-footer">
      <nav aria-label={labels.navLabel}>
        <ul className="site-footer__links">
          {LEGAL_DOCUMENTS.map((document) => (
            <li key={document.key}>
              <Link href={document.path}>{labels[document.key]}</Link>
            </li>
          ))}
        </ul>
      </nav>
      <p className="site-footer__product">
        {before}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        {after}
      </p>
    </footer>
  );
}
