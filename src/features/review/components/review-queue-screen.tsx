"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { APP_HOME_PATH, REVIEW_PATH } from "@/constants";
import type { SubjectCode } from "@/features/knowledge/types";
import { useI18n } from "@/features/localization/i18n-provider";
import type { QueueFilter, QueueItem, ReviewState } from "../types";
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
};

const FILTERS: QueueFilter[] = ["pending", "returned", "accepted", "all"];

/** Queue link keeping subject, filter and page in the URL (bookmarkable, back button works). */
export function queueHref(subject: SubjectCode, filter: QueueFilter, page = 1): string {
  const params = new URLSearchParams({ predmet: subject, prikaz: filter });
  if (page > 1) params.set("stranica", String(page));
  return `${REVIEW_PATH}?${params.toString()}`;
}

/** Review queue of one subject: filters, progress and one page of records. */
export function ReviewQueueScreen({ subjects, selected, filter, hasQueue, counts, items, page, pages, noSubjects }: Props): ReactNode {
  const { dictionary } = useI18n();
  const labels = dictionary.review;
  const total = counts.pending + counts.returned + counts.accepted;

  return (
    <ReviewShell backHref={APP_HOME_PATH} backLabel={labels.back} title={labels.title} subtitle={labels.subtitle}>
      {noSubjects && <p className="notice">{labels.noSubjects}</p>}
      {!noSubjects && subjects.length === 0 && <p className="notice">{labels.noScope}</p>}

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
              <nav className="review-tabs" aria-label={labels.filterLabel}>
                {FILTERS.map((option) => (
                  <Link key={option} href={queueHref(selected, option)} className={option === filter ? "chip chip--on" : "chip"} aria-current={option === filter ? "page" : undefined}>
                    {labels.filters[option]} ({option === "all" ? total : counts[option]})
                  </Link>
                ))}
              </nav>

              {items.length === 0 ? (
                <p>{labels.empty}</p>
              ) : (
                <ul className="review-list">
                  {items.map((item) => (
                    <li key={item.recordId}>
                      <Link href={`${REVIEW_PATH}/${item.recordId}?prikaz=${filter}`} className="review-list__item" data-state={item.state}>
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
