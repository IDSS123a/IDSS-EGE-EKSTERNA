"use client";

import { useEffect, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { BRAND_LOGO_HEIGHT_PX, BRAND_LOGO_PATH, BRAND_LOGO_WIDTH_PX } from "@/constants";
import { formatDateTime } from "@/features/canon/components/format";
import { useI18n } from "@/features/localization/i18n-provider";

/**
 * The uniform IDSS print format (PDL-036): every printed analysis and result starts with the same letterhead (official
 * logo, product name, school, document title, print time, confidentiality line) and ends every page with the product
 * name and the page number (print CSS, `@page`). Visible only on paper and in PDF.
 */
export function PrintHeader({ title, subtitle, confidential }: { title: string; subtitle?: string; confidential: boolean }): ReactNode {
  const { dictionary, locale } = useI18n();
  const labels = dictionary.print;
  const [printedAt, setPrintedAt] = useState<string | null>(null);

  useEffect(() => {
    // The time is taken when printing starts, so the server and the browser never render different text.
    const stamp = () => flushSync(() => setPrintedAt(new Date().toISOString()));
    window.addEventListener("beforeprint", stamp);
    return () => window.removeEventListener("beforeprint", stamp);
  }, []);

  return (
    <div className="print-only idss-print-header">
      <div className="idss-print-header__top">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="idss-print-header__logo" src={BRAND_LOGO_PATH} alt={dictionary.splash.logoAlt} width={BRAND_LOGO_WIDTH_PX} height={BRAND_LOGO_HEIGHT_PX} />
        <div className="idss-print-header__product">
          <strong>{dictionary.home.title}</strong>
          <span>{dictionary.home.eyebrow}</span>
        </div>
      </div>
      <div className="idss-print-header__stripe" aria-hidden="true" />
      <p className="idss-print-header__title">{title}</p>
      {subtitle && <p className="idss-print-header__subtitle">{subtitle}</p>}
      <p className="idss-print-header__meta">
        {printedAt ? labels.printedAt.replace("{date}", formatDateTime(printedAt, locale)) : ""}
        {confidential ? ` ${labels.confidential}` : ""}
      </p>
    </div>
  );
}

/** The one print button of the uniform format; the browser's print dialog also saves a PDF. */
export function PrintButton(): ReactNode {
  const { dictionary } = useI18n();
  return (
    <button type="button" className="button-secondary" onClick={() => window.print()}>
      {dictionary.print.button}
    </button>
  );
}
