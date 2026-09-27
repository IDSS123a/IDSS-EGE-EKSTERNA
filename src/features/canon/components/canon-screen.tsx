"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { APP_HOME_PATH } from "@/constants";
import { logoutAction } from "@/features/authentication/actions";
import { useI18n } from "@/features/localization/i18n-provider";
import { SiteHeader } from "@/features/shell/components/site-header";
import type { CanonDocument, CanonRegistry } from "../types";
import { formatDateTime } from "./format";
import { UploadForm } from "./upload-form";
import { VersionCard } from "./version-card";

/**
 * GET /app/kanon screen: the canon registry. Receives only data the server read under RLS
 * and the capability decision; lifecycle buttons appear only for canon.publish and are
 * checked again by the actions and the database.
 */
export function CanonScreen({ registry, canPublish }: { registry: CanonRegistry; canPublish: boolean }): ReactNode {
  const { dictionary } = useI18n();
  const labels = dictionary.canon;
  return (
    <div className="page">
      <SiteHeader
        actions={
          <form action={logoutAction}>
            <button type="submit" className="button-secondary">{dictionary.account.logout}</button>
          </form>
        }
      />
      <main className="page__main">
        <Link href={APP_HOME_PATH} className="back-link">{dictionary.accounts.back}</Link>
        <h1 className="home__title">{labels.title}</h1>
        <p className="home__subtitle">{labels.subtitle}</p>
        <p className="notice">{labels.generation}: <strong>{registry.generation}</strong></p>

        {canPublish && <UploadForm documents={registry.documents} types={registry.types} />}

        {registry.documents.length === 0 ? (
          <section className="card"><p>{labels.empty}</p></section>
        ) : (
          registry.documents.map((document) => <DocumentCard key={document.id} document={document} registry={registry} canPublish={canPublish} />)
        )}
      </main>
    </div>
  );
}

function DocumentCard({ document, registry, canPublish }: { document: CanonDocument; registry: CanonRegistry; canPublish: boolean }): ReactNode {
  const { dictionary, locale } = useI18n();
  const labels = dictionary.canon;
  const type = registry.types.find((candidate) => candidate.code === document.typeCode);
  const typeName = labels.types[document.typeCode as keyof typeof labels.types] ?? type?.name ?? document.typeCode;
  const derives = (type?.derives ?? []).map((key) => labels.derivesItems[key as keyof typeof labels.derivesItems] ?? key);
  const versionTitle = (versionId: string) => document.versions.find((version) => version.id === versionId)?.officialTitle ?? "";

  return (
    <section className="card canon-document" aria-labelledby={`document-${document.id}`}>
      <h2 id={`document-${document.id}`}>{document.title}</h2>
      <p className="canon-document__type">
        {typeName}
        {document.subjectLabel ? `, ${document.subjectLabel}` : ""}
      </p>
      {derives.length > 0 && (
        <p className="canon-document__derives">{labels.derives}: {derives.join(", ")}</p>
      )}

      <h3>{labels.versions}</h3>
      <ul className="canon-version-list">
        {document.versions.map((version) => <VersionCard key={version.id} version={version} canPublish={canPublish} />)}
      </ul>

      <details className="canon-history">
        <summary>{labels.history} ({document.history.length})</summary>
        {document.history.length === 0 ? (
          <p>{labels.noHistory}</p>
        ) : (
          <ol className="canon-history__list">
            {document.history.map((entry) => (
              <li key={entry.id}>
                <time dateTime={entry.occurredAt}>{formatDateTime(entry.occurredAt, locale)}</time>
                <span className="canon-history__event">{labels.events[entry.event]}</span>
                <span>{versionTitle(entry.versionId)}</span>
                {entry.actorName && <span>{entry.actorName}</span>}
                {entry.reason && <span>{labels.reason}: {entry.reason}</span>}
              </li>
            ))}
          </ol>
        )}
      </details>
    </section>
  );
}
