"use client";

import { useActionState, type ReactNode } from "react";
import { APP_HOME_PATH, RETRIEVAL_QUERY_MAX_LENGTH, RETRIEVAL_QUERY_MIN_LENGTH } from "@/constants";
import type { SubjectCode } from "@/features/knowledge/types";
import { useI18n } from "@/features/localization/i18n-provider";
import { ReviewShell } from "@/features/review/components/review-shell";
import { buildIndexAction, buildSemanticIndexAction, searchCanonAction } from "../actions";
import { citationOf } from "../domain/context";
import type { IndexResult, SearchResult, SemanticIndexResult } from "../types";

type Props = {
  subjects: { id: string; code: SubjectCode }[];
  chunkTotal: number;
  canBuild: boolean;
  /** Chunks with a vector for the current embedding model (PDL-023). */
  embeddedTotal: number;
  /** True when the server has a Gemini key (search by meaning possible). */
  semanticConfigured: boolean;
};

/** Staff search over trusted canon with cited results and the fixed refusal (Sprint 05). */
export function SearchScreen({ subjects, chunkTotal, canBuild, embeddedTotal, semanticConfigured }: Props): ReactNode {
  const { dictionary } = useI18n();
  const labels = dictionary.search;
  const [result, searchAction, searching] = useActionState<SearchResult | null, FormData>(searchCanonAction, null);
  const [indexResult, indexAction, building] = useActionState<IndexResult | null, FormData>(buildIndexAction, null);
  const [semanticResult, semanticAction, embedding] = useActionState<SemanticIndexResult | null, FormData>(buildSemanticIndexAction, null);
  const embedded = semanticResult?.success ? semanticResult.data.embedded : embeddedTotal;
  const semanticReady = semanticConfigured && embedded > 0;
  const subjectCode = (id: string) => subjects.find((subject) => subject.id === id)?.code;

  return (
    <ReviewShell backHref={APP_HOME_PATH} backLabel={dictionary.review.back} title={labels.title} subtitle={labels.subtitle}>
      <p className="notice">{labels.method}</p>

      {canBuild && (
        <section className="card" aria-labelledby="index-title">
          <h2 id="index-title">{labels.index.title}</h2>
          <p>{labels.index.intro}</p>
          <p>{labels.index.counts.replace("{total}", String(indexResult?.success ? indexResult.data.total : chunkTotal))}</p>
          <form action={indexAction} className="inline-form">
            <button type="submit" className="button-secondary" disabled={building} aria-busy={building}>{building ? labels.index.building : labels.index.build}</button>
            <span className="action-feedback" aria-live="polite">
              {indexResult?.success && (
                <span className="action-feedback--ok">
                  {labels.index.built.replace("{q}", String(indexResult.data.questionChunksAdded)).replace("{r}", String(indexResult.data.ruleChunksAdded)).replace("{total}", String(indexResult.data.total))}
                </span>
              )}
              {indexResult && !indexResult.success && <span className="action-feedback--error">{labels.errors[indexResult.code]}</span>}
            </span>
          </form>
        </section>
      )}

      {canBuild && (
        <section className="card" aria-labelledby="semantic-title">
          <h2 id="semantic-title">{labels.semantic.title}</h2>
          <p>{labels.semantic.intro}</p>
          {!semanticConfigured && <p className="notice">{labels.semantic.noKey}</p>}
          <p>{labels.semantic.counts.replace("{embedded}", String(embedded)).replace("{total}", String(indexResult?.success ? indexResult.data.total : chunkTotal))}</p>
          <form action={semanticAction} className="inline-form">
            <button type="submit" className="button-secondary" disabled={embedding || !semanticConfigured} aria-busy={embedding}>{embedding ? labels.semantic.building : labels.semantic.build}</button>
            <span className="action-feedback" aria-live="polite">
              {semanticResult?.success && (
                <span className="action-feedback--ok">
                  {labels.semantic.built.replace("{stored}", String(semanticResult.data.stored)).replace("{embedded}", String(semanticResult.data.embedded))}
                  {!semanticResult.data.complete && semanticResult.data.skipped === 0 && ` ${labels.semantic.continue}`}
                </span>
              )}
              {semanticResult?.success && semanticResult.data.skipped > 0 && (
                <span className="action-feedback--error">
                  {labels.semantic.skipped.replace("{n}", String(semanticResult.data.skipped)).replace("{detail}", semanticResult.data.detail ?? "")}
                </span>
              )}
              {semanticResult && !semanticResult.success && (
                <span className="action-feedback--error">
                  {labels.errors[semanticResult.code]}
                  {semanticResult.detail ? ` (${semanticResult.detail})` : ""}
                </span>
              )}
            </span>
          </form>
        </section>
      )}

      <section className="card" aria-labelledby="search-title">
        <h2 id="search-title" className="sr-only">{labels.title}</h2>
        {chunkTotal === 0 && !indexResult?.success && <p>{labels.empty}</p>}
        <form action={searchAction} className="form form--grid">
          <div className="form__field search-form__query">
            <label htmlFor="query">{labels.query}</label>
            <input id="query" name="query" type="search" required minLength={RETRIEVAL_QUERY_MIN_LENGTH} maxLength={RETRIEVAL_QUERY_MAX_LENGTH} aria-describedby="query-hint" />
            <p id="query-hint" className="form__hint">{labels.queryHint}{semanticReady ? ` ${labels.semantic.privacy}` : ""}</p>
          </div>
          <div className="form__field">
            <label htmlFor="subjectId">{labels.subject}</label>
            <select id="subjectId" name="subjectId" defaultValue="">
              <option value="">{labels.allSubjects}</option>
              {subjects.map((subject) => <option key={subject.id} value={subject.id}>{dictionary.subjects[subject.code]}</option>)}
            </select>
          </div>
          <div className="form__actions">
            <button type="submit" className="button-primary" disabled={searching} aria-busy={searching}>{searching ? labels.searching : labels.submit}</button>
          </div>
        </form>

        <div aria-live="polite">
          {result && !result.success && <p className="action-feedback--error" role="alert">{labels.errors[result.code]}</p>}
          {result?.success && result.data.fallback && <p className="notice">{labels.fallback}</p>}
          {result?.success && <p className="form__hint">{labels.methods[result.data.method]}</p>}
          {result?.success && result.data.refused && <p className="notice">{labels.refusal}</p>}
          {result?.success && !result.data.refused && (
            <>
              <p>{labels.results.replace("{n}", String(result.data.results.length))}</p>
              <ol className="search-results">
                {result.data.results.map((chunk) => {
                  const code = subjectCode(chunk.subjectId);
                  return (
                    <li key={chunk.chunkId} className="rule-item">
                      <div className="canon-version__head">
                        <strong>{labels.kinds[chunk.sourceKind]}</strong>
                        <span className="form__hint">{code ? dictionary.subjects[code] : ""}</span>
                      </div>
                      {/* Canonical text stays verbatim in its source language (AMB-13, P-13 exempt). */}
                      <pre className="review-record__text" lang={code === "german" ? "de" : "bs"}>{chunk.content}</pre>
                      <p className="form__hint">{labels.source}: {citationOf(chunk)}{chunk.citation.official_title ? `, ${chunk.citation.official_title}` : ""}</p>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </div>
      </section>
    </ReviewShell>
  );
}
