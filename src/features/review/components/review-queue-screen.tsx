"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { APP_HOME_PATH, REVIEW_PATH } from "@/constants";
import type { SubjectCode } from "@/features/knowledge/types";
import { useI18n } from "@/features/localization/i18n-provider";
import { KEY_QUERY_MAX_LENGTH } from "../domain/queue";
import type { QueueFilter, QueueItem, ReviewState, TextProposalStatus } from "../types";
import { ReviewShell } from "./review-shell";

type Props = {
  subjects: { id: string; code: SubjectCode }[];
  selected: SubjectCode | null;
  filter: QueueFilter;
  hasQueue: boolean;
  counts: Record<ReviewState, number>;
  items: QueueItem[];
  page: number;
  pages: number;
  /** True when no subject rows exist yet (facts not loaded). */
  noSubjects: boolean;
  /** Record-key search from the URL ("" when none). */
  keyQuery: string;
  /** Prepared text-revision proposals of this subject (AMB-19). */
  proposals: TextProposalStatus[];
};

const FILTERS: QueueFilter[] = ["pending", "returned", "accepted", "all"];

/** Queue link keeping subject, filter and page in the URL (bookmarkable, back button works). */
export function queueHref(subject: SubjectCode, filter: QueueFilter, page = 1): string {
  const params = new URLSearchParams({ predmet: subject, prikaz: filter });
  if (page > 1) params.set("stranica", String(page));
  return `${REVIEW_PATH}?${params.toString()}`;
}

/** Review queue of one subject: filters, progress and one page of records. */
export function ReviewQueueScreen({ subjects, selected, filter, hasQueue, counts, items, page, pages, noSubjects, keyQuery, proposals }: Props): ReactNode {
  const { dictionary } = useI18n();
  const labels = dictionary.review;
  const total = counts.pending + counts.returned + counts.accepted;
  const searching = keyQuery.trim() !== "";
  // Search results link with "all" so previous and next on the record screen walk the whole subject.
  const itemFilter: QueueFilter = searching ? "all" : filter;

  return (
    <ReviewShell backHref={APP_HOME_PATH} backLabel={labels.back} title={labels.title} subtitle={labels.subtitle}>
      {noSubjects && <p className="notice">{labels.noSubjects}</p>}
      {!noSubjects && subjects.length === 0 && <p className="notice">{labels.noScope}</p>}

      {selected && proposals.length > 0 && (
        <section className="card" aria-labelledby="review-proposals-title">
          <h2 id="review-proposals-title">{labels.proposals.title}</h2>
          <p>{proposals.every((proposal) => proposal.confirmed) ? labels.proposals.done : labels.proposals.hint}</p>
          <ul className="review-list">
            {proposals.map((proposal) => (
              <li key={proposal.recordId}>
                <Link href={`${REVIEW_PATH}/${proposal.recordId}?prikaz=all`} className="review-list__item review-list__item--compact" data-state={proposal.confirmed ? "accepted" : "pending"}>
                  <strong className="review-list__key">{proposal.recordKey}</strong>
                  <span className="status-pill" data-review={proposal.confirmed ? "accepted" : "pending"}>{proposal.confirmed ? labels.proposals.confirmed : labels.proposals.waiting}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {selected && (
        <section className="card" aria-labelledby="review-queue-title">
          <nav className="review-tabs" aria-label={labels.subjectsLabel}>
            {subjects.map((subject) => (
              <Link key={subject.id} href={queueHref(subject.code, filter)} className={subject.code === selected ? "chip chip--on" : "chip"} aria-current={subject.code === selected ? "page" : undefined}>
                {dictionary.subjects[subject.code]}
              </Link>
            ))}
            <Link href={`${REVIEW_PATH}/pravila?predmet=${selected}`} className="button-secondary review-tabs__rules">{labels.rulesLink}</Link>
          </nav>

          <h2 id="review-queue-title">{dictionary.subjects[selected]}</h2>
          {!hasQueue ? (
            <p>{labels.noQueue}</p>
          ) : (
            <>
              <p>
                {labels.progress.replace("{done}", String(counts.accepted)).replace("{total}", String(total))}
              </p>
              <progress className="review-progress" max={Math.max(total, 1)} value={counts.accepted} aria-label={labels.progress.replace("{done}", String(counts.accepted)).replace("{total}", String(total))} />
              <form className="review-key-search" action={REVIEW_PATH} method="get" role="search">
                <input type="hidden" name="predmet" value={selected} />
                <div className="form__field">
                  <label htmlFor="review-key">{labels.keySearch.label}</label>
                  <input id="review-key" name="oznaka" defaultValue={keyQuery} maxLength={KEY_QUERY_MAX_LENGTH} placeholder={labels.keySearch.placeholder} autoComplete="off" spellCheck={false} />
                </div>
                <button type="submit" className="button-primary">{labels.keySearch.submit}</button>
                {searching && <Link className="button-secondary" href={queueHref(selected, filter)}>{labels.keySearch.clear}</Link>}
              </form>
              {searching && <p aria-live="polite">{(items.length === 0 ? labels.keySearch.none : labels.keySearch.results).replace("{query}", keyQuery.trim())}</p>}
              <nav className="review-tabs" aria-label={labels.filterLabel}>
                {FILTERS.map((option) => (
                  <Link key={option} href={queueHref(selected, option)} className={option === filter && !searching ? "chip chip--on" : "chip"} aria-current={option === filter && !searching ? "page" : undefined}>
                    {labels.filters[option]} ({option === "all" ? total : counts[option]})
                  </Link>
                ))}
              </nav>

              {items.length === 0 ? (
                !searching && <p>{labels.empty}</p>
              ) : (
                <ul className="review-list">
                  {items.map((item) => (
                    <li key={item.recordId}>
                      <Link href={`${REVIEW_PATH}/${item.recordId}?prikaz=${itemFilter}`} className="review-list__item" data-state={item.state}>
                        <strong className="review-list__key">{item.recordKey}</strong>
                        <span>{item.area ?? ""}</span>
                        <span>{item.taskType ? (labels.taskTypes[item.taskType as keyof typeof labels.taskTypes] ?? item.taskType) : ""}</span>
                        <span className="review-list__structure" data-structure={item.structuralStatus}>{labels.structural[item.structuralStatus]}</span>
                        <span className="status-pill" data-review={item.state}>{labels.states[item.state]}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              {pages > 1 && (
                <nav className="review-pager" aria-label={labels.pageOf.replace("{page}", String(page)).replace("{pages}", String(pages))}>
                  {page > 1 ? <Link className="button-secondary" href={queueHref(selected, filter, page - 1)}>{labels.previousPage}</Link> : <span />}
                  <span>{labels.pageOf.replace("{page}", String(page)).replace("{pages}", String(pages))}</span>
                  {page < pages ? <Link className="button-secondary" href={queueHref(selected, filter, page + 1)}>{labels.nextPage}</Link> : <span />}
                </nav>
              )}
            </>
          )}
        </section>
      )}
    </ReviewShell>
  );
}
