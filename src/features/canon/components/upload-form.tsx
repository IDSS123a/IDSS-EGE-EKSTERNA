"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { CANON_MAX_BYTES, CANON_MIME_TYPE } from "@/constants";
import { useI18n } from "@/features/localization/i18n-provider";
import { prepareCanonUploadAction, registerCanonVersionAction } from "../actions";
import type { CanonActionResult, CanonDocument, CanonDocumentType, CanonErrorCode } from "../types";
import { CanonFeedback } from "./canon-feedback";

type Phase = "idle" | "uploading" | "registering";

/**
 * Upload of a canonical PDF as a new document or a new version (canon.publish only; the
 * server decides again). Step 1 asks the server for a single-use upload URL, step 2 sends the
 * file straight to private storage, step 3 lets the server verify and register it.
 * The size check here is only for a quick answer; the server checks the stored bytes.
 */
export function UploadForm({ documents, types }: { documents: CanonDocument[]; types: CanonDocumentType[] }): ReactNode {
  const { dictionary } = useI18n();
  const labels = dictionary.canon;
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [target, setTarget] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<CanonActionResult | { success: false; code: CanonErrorCode } | null>(null);
  const [, startTransition] = useTransition();

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const form = event.currentTarget;
    const file = (form.elements.namedItem("file") as HTMLInputElement).files?.[0];
    if (!file) return setResult({ success: false, code: "VALIDATION" });
    if (file.size > CANON_MAX_BYTES) return setResult({ success: false, code: "TOO_LARGE" });

    startTransition(async () => {
      setResult(null);
      setPhase("uploading");
      const ticket = await prepareCanonUploadAction({ byteSize: file.size });
      if (!ticket.success) {
        setPhase("idle");
        return setResult(ticket);
      }
      const upload = await fetch(ticket.data.uploadUrl, {
        method: "PUT",
        headers: { "content-type": CANON_MIME_TYPE, "x-upsert": "false" },
        body: file,
      }).catch(() => null);
      if (!upload || !upload.ok) {
        setPhase("idle");
        return setResult({ success: false, code: upload?.status === 413 ? "TOO_LARGE" : "UPLOAD_MISSING" });
      }
      setPhase("registering");
      const data = new FormData(form);
      data.delete("file");
      data.set("uploadId", ticket.data.uploadId);
      const registered = await registerCanonVersionAction(null, data);
      setPhase("idle");
      setResult(registered);
      if (registered.success) {
        formRef.current?.reset();
        setTarget("");
        router.refresh();
      }
    });
  };

  const busy = phase !== "idle";
  const isNewDocument = target === "";

  return (
    <section className="card" aria-labelledby="canon-upload-title">
      <h2 id="canon-upload-title">{labels.uploadTitle}</h2>
      <p>{labels.uploadIntro}</p>
      <form ref={formRef} onSubmit={submit} className="form form--grid" noValidate>
        <div className="form__field">
          <label htmlFor="canon-target">{labels.target}</label>
          <select id="canon-target" name="documentId" value={target} onChange={(event) => setTarget(event.target.value)}>
            <option value="">{labels.newDocument}</option>
            {documents.map((document) => (
              <option key={document.id} value={document.id}>{document.title}</option>
            ))}
          </select>
        </div>
        {isNewDocument && (
          <>
            <div className="form__field">
              <label htmlFor="canon-type">{labels.type}</label>
              <select id="canon-type" name="typeCode" required defaultValue="subject_catalogue">
                {types.map((type) => (
                  <option key={type.code} value={type.code}>{labels.types[type.code as keyof typeof labels.types] ?? type.name}</option>
                ))}
              </select>
            </div>
            <div className="form__field">
              <label htmlFor="canon-document-title">{labels.documentTitle}</label>
              <input id="canon-document-title" name="documentTitle" required maxLength={200} />
            </div>
            <div className="form__field">
              <label htmlFor="canon-subject">{labels.subjectLabel} <span className="form__optional">({labels.optional})</span></label>
              <input id="canon-subject" name="subjectLabel" maxLength={80} />
            </div>
          </>
        )}
        <div className="form__field">
          <label htmlFor="canon-file">{labels.file}</label>
          <input id="canon-file" name="file" type="file" accept={`${CANON_MIME_TYPE},.pdf`} required />
        </div>
        <div className="form__field">
          <label htmlFor="canon-authority">{labels.issuingAuthority}</label>
          <input id="canon-authority" name="issuingAuthority" required maxLength={200} />
        </div>
        <div className="form__field">
          <label htmlFor="canon-official-title">{labels.officialTitle}</label>
          <input id="canon-official-title" name="officialTitle" required maxLength={300} />
        </div>
        <div className="form__field">
          <label htmlFor="canon-reference">{labels.referenceNumber} <span className="form__optional">({labels.optional})</span></label>
          <input id="canon-reference" name="referenceNumber" maxLength={100} />
        </div>
        <div className="form__field">
          <label htmlFor="canon-published">{labels.publishedOn} <span className="form__optional">({labels.optional})</span></label>
          <input id="canon-published" name="publishedOn" type="date" />
        </div>
        <div className="form__field">
          <label htmlFor="canon-effective">{labels.effectiveFrom} <span className="form__optional">({labels.optional})</span></label>
          <input id="canon-effective" name="effectiveFrom" type="date" />
        </div>
        <div className="form__field">
          <label htmlFor="canon-revision">{labels.revisionLabel} <span className="form__optional">({labels.optional})</span></label>
          <input id="canon-revision" name="revisionLabel" maxLength={60} />
        </div>
        <div className="form__actions">
          <button type="submit" className="button-primary" disabled={busy} aria-busy={busy}>
            {phase === "uploading" ? labels.uploading : phase === "registering" ? labels.registering : labels.submit}
          </button>
          <CanonFeedback result={result} />
        </div>
      </form>
    </section>
  );
}
