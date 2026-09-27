"use client";

import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";
import { REVIEW_PATH, REVIEW_TEXT_MAX_LENGTH } from "@/constants";
import { formatDateTime } from "@/features/canon/components/format";
import { useI18n } from "@/features/localization/i18n-provider";
import { ReviewShell } from "@/features/review/components/review-shell";
import { SourceRegion } from "@/features/review/components/source-region";
import { decideRuleReviewAction } from "../actions";
import { formatRuleValue } from "../domain/format";
import type { CanonicalRule, KnowledgeActionResult, Subject } from "../types";

type Props = {
  subjects: Subject[];
  selected: Subject | null;
  subjectEvidence: { page: number; quote: string }[];
  rules: CanonicalRule[];
  canReview: boolean;
  sourceUrl: string | null;
};

/** Canonical exam rules of one subject with their page quotes and review state. */
export function RulesScreen({ subjects, selected, subjectEvidence, rules, canReview, sourceUrl }: Props): ReactNode {
  const { dictionary } = useI18n();
  const labels = dictionary.review;
  return (
    <ReviewShell backHref={selected ? `${REVIEW_PATH}?predmet=${selected.code}` : REVIEW_PATH} backLabel={labels.record.backToQueue} title={labels.rules.title} subtitle={labels.rules.intro}>
      {subjects.length === 0 && <p className="notice">{labels.noScope}</p>}
      {selected && (
        <section className="card" aria-labelledby="rules-subject">
          <nav className="review-tabs" aria-label={labels.subjectsLabel}>
            {subjects.map((subject) => (
              <Link key={subject.id} href={`${REVIEW_PATH}/pravila?predmet=${subject.code}`} className={subject.id === selected.id ? "chip chip--on" : "chip"} aria-current={subject.id === selected.id ? "page" : undefined}>
                {dictionary.subjects[subject.code]}
              </Link>
            ))}
          </nav>
          <h2 id="rules-subject" lang="bs">{selected.officialName}</h2>
          <dl className="canon-version__meta">
            <div><dt>{labels.rules.legalBasis}</dt><dd lang="bs">{selected.legalBasis}</dd></div>
            <div>
              <dt>{labels.rules.subjectSource}</dt>
              <dd>{subjectEvidence.map((evidence) => <Quote key={evidence.quote} evidence={evidence} />)}</dd>
            </div>
          </dl>
          {rules.length === 0 && <p>{labels.rules.empty}</p>}
          <ul className="rule-list">
            {rules.map((rule) => <RuleItem key={rule.id} rule={rule} canReview={canReview} sourceUrl={sourceUrl} />)}
          </ul>
        </section>
      )}
    </ReviewShell>
  );
}

function Quote({ evidence }: { evidence: { page: number; quote: string } }): ReactNode {
  const { dictionary } = useI18n();
  return (
    <blockquote className="rule-quote">
      <span lang="bs">{evidence.quote}</span> <cite>{dictionary.review.rules.page.replace("{page}", String(evidence.page))}</cite>
    </blockquote>
  );
}

function RuleItem({ rule, canReview, sourceUrl }: { rule: CanonicalRule; canReview: boolean; sourceUrl: string | null }): ReactNode {
  const { dictionary, locale } = useI18n();
  const labels = dictionary.review;
  const [result, formAction, pending] = useActionState<KnowledgeActionResult | null, FormData>(decideRuleReviewAction, null);
  const [shownPage, setShownPage] = useState<number | null>(null);
  const status = rule.review?.decision ?? "none";
  const pages = [...new Set(rule.evidence.map((evidence) => evidence.page))];

  return (
    <li className="rule-item" data-review={status}>
      <div className="canon-version__head">
        <strong>{labels.rules.codes[rule.ruleCode as keyof typeof labels.rules.codes] ?? rule.ruleCode}</strong>
        <span className="status-pill" data-review={status}>{labels.rules.status[status]}</span>
      </div>
      <p><strong>{labels.rules.value}:</strong> {formatRuleValue(rule.value, labels.rules.valueKeys, labels.rules.valueWords)}</p>
      <div>
        <span className="form__hint">{labels.rules.quote}</span>
        {rule.evidence.map((evidence) => <Quote key={`${evidence.page}-${evidence.quote}`} evidence={evidence} />)}
      </div>
      {sourceUrl && (
        <div className="link-row">
          {pages.map((page) => (
            <button key={page} type="button" className="chip" aria-pressed={shownPage === page} onClick={() => setShownPage(shownPage === page ? null : page)}>
              {labels.rules.showPage} {labels.rules.page.replace("{page}", String(page))}
            </button>
          ))}
        </div>
      )}
      {sourceUrl && shownPage !== null && <SourceRegion sourceUrl={sourceUrl} page={shownPage} region={null} label={labels.source.page.replace("{page}", String(shownPage))} />}
      {rule.review && (
        <p className="form__hint">
          {labels.decision.by.replace("{name}", rule.review.reviewerName ?? "").replace("{date}", formatDateTime(rule.review.decidedAt, locale))}
          {rule.review.note ? `: ${rule.review.note}` : ""}
        </p>
      )}
      {canReview && (
        <form action={formAction} className="inline-form">
          <input type="hidden" name="ruleId" value={rule.id} />
          <input type="hidden" name="subjectId" value={rule.subjectId} />
          <label className="sr-only" htmlFor={`note-${rule.id}`}>{labels.rules.note}</label>
          <input id={`note-${rule.id}`} name="note" placeholder={labels.rules.note} maxLength={REVIEW_TEXT_MAX_LENGTH} aria-describedby={`note-hint-${rule.id}`} />
          <span id={`note-hint-${rule.id}`} className="sr-only">{labels.rules.noteHint}</span>
          <button type="submit" name="decision" value="confirmed" className="button-secondary" disabled={pending}>{labels.rules.confirm}</button>
          <button type="submit" name="decision" value="disputed" className="button-secondary" disabled={pending}>{labels.rules.dispute}</button>
          <span className="action-feedback" aria-live="polite">
            {result?.success && <span className="action-feedback--ok">{labels.messages[result.data.message as "RULE_CONFIRMED" | "RULE_DISPUTED"]}</span>}
            {result && !result.success && <span className="action-feedback--error">{labels.errors[result.code as keyof typeof labels.errors] ?? dictionary.facts.errors[result.code]}</span>}
          </span>
        </form>
      )}
    </li>
  );
}
