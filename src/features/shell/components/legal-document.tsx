"use client";

import type { ReactNode } from "react";
import bs from "../../../../content/legal/bs.json";
import de from "../../../../content/legal/de.json";
import en from "../../../../content/legal/en.json";
import type { LEGAL_DOCUMENTS } from "@/constants";
import { useI18n } from "@/features/localization/i18n-provider";
import { ReviewShell } from "@/features/review/components/review-shell";

type DocumentKey = (typeof LEGAL_DOCUMENTS)[number]["key"];

/** Legal texts per interface language (content/legal, written for IDSS and confirmed by the Director, AMB-20). */
const TEXTS = { bs, de, en } satisfies Record<string, typeof bs>;

/** A legal document in the interface language, with its version line. */
export function LegalDocument({ documentKey }: { documentKey: DocumentKey }): ReactNode {
  const { dictionary, locale } = useI18n();
  const texts = TEXTS[locale];
  const document = texts[documentKey];
  return (
    <ReviewShell backHref="/" backLabel={dictionary.footer.back} title={document.title}>
      <article className="card legal-document">
        {document.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </section>
        ))}
        <p className="form__hint">{texts.version}</p>
      </article>
    </ReviewShell>
  );
}
