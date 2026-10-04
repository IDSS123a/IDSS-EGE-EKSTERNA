"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { APP_HOME_PATH, GUIDE_PATH } from "@/constants";
import { useI18n } from "@/features/localization/i18n-provider";
import { ReviewShell } from "@/features/review/components/review-shell";
import { guideImage, type Guide } from "../content";

/** Screen labels in the guide text are written as **label** and shown in bold. */
function Rich({ text }: { text: string }): ReactNode {
  return text.split("**").map((part, index) => (index % 2 === 1 ? <strong key={index}>{part}</strong> : <span key={index}>{part}</span>));
}

/**
 * The personal user guide (PDL-031): contents, then every section with numbered steps, each with a screenshot of the
 * real screen (trial data). Prints in the IDSS format; the Director chooses any participant's guide above.
 */
export function GuideScreen({ guide, choices, selected }: { guide: Guide; choices: { key: string; label: string }[] | null; selected: string }): ReactNode {
  const { dictionary, locale } = useI18n();
  const labels = dictionary.guide;
  // Steps are numbered through the whole guide.
  const firstNumber = guide.sections.map((_, index) => guide.sections.slice(0, index).reduce((sum, section) => sum + section.steps.length, 1));

  return (
    <ReviewShell backHref={APP_HOME_PATH} backLabel={labels.back} title={guide.title} subtitle={labels.subtitle} print={{ confidential: false }}>
      {locale !== "bs" && <p className="notice">{labels.languageNote}</p>}
      {choices && (
        <nav className="link-row no-print" aria-label={labels.choose}>
          {choices.map((choice) => (
            <Link key={choice.key} href={`${GUIDE_PATH}?vodic=${choice.key}`} className={choice.key === selected ? "button-primary" : "button-secondary"} aria-current={choice.key === selected ? "page" : undefined}>{choice.label}</Link>
          ))}
        </nav>
      )}
      <section className="card guide-intro">
        <p><Rich text={guide.intro} /></p>
        <h2>{labels.contents}</h2>
        <ol className="guide-toc">
          {guide.sections.map((section) => <li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>)}
        </ol>
        <p className="form__hint">{labels.trialData}</p>
      </section>
      {guide.sections.map((section, sectionIndex) => (
        <section key={section.id} id={section.id} className="card guide-section" aria-labelledby={`${section.id}-title`}>
          <h2 id={`${section.id}-title`}>{section.title}</h2>
          {section.intro && <p><Rich text={section.intro} /></p>}
          <ol className="guide-steps">
            {section.steps.map((entry, stepIndex) => {
              return (
                <li key={entry.image + entry.title} className="guide-step">
                  <h3><span className="guide-step__number">{firstNumber[sectionIndex] + stepIndex}</span> {entry.title}</h3>
                  <p><Rich text={entry.text} /></p>
                  <figure className="guide-step__figure">
                    {/* Screenshots are static files in public/guide (tools/guide-screens). */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={guideImage(entry.image)} alt={`${labels.screenshot}: ${entry.title}`} loading="lazy" />
                  </figure>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </ReviewShell>
  );
}
