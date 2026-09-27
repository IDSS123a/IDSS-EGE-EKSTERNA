"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import { REVIEW_RENDER_SCALE } from "@/constants";
import { useI18n } from "@/features/localization/i18n-provider";

/**
 * The original catalogue page region beside an extracted record, rendered in the browser with
 * pdf.js from the same-origin source route (no text is re-typed: the reviewer compares the
 * extraction with the printed page). "Whole page" shows the full page with the region marked.
 */

const documents = new Map<string, Promise<PDFDocumentProxy>>();

async function loadDocument(url: string): Promise<PDFDocumentProxy> {
  const cached = documents.get(url);
  if (cached) return cached;
  const promise = (async () => {
    // The legacy build: the modern one needs very recent JavaScript (e.g. Map.getOrInsertComputed)
    // that older phones, tablets and school computers lack (P-14).
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    if (!pdfjs.GlobalWorkerOptions.workerPort) {
      pdfjs.GlobalWorkerOptions.workerPort = new Worker(new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url), { type: "module" });
    }
    const response = await fetch(url, { credentials: "same-origin" });
    if (!response.ok) throw new Error(`source ${response.status}`);
    return pdfjs.getDocument({ data: new Uint8Array(await response.arrayBuffer()) }).promise;
  })();
  documents.set(url, promise);
  promise.catch(() => documents.delete(url));
  return promise;
}

type Props = {
  sourceUrl: string;
  page: number;
  /** [x0, y0, x1, y1] in PDF points from the top-left corner, or null for the whole page. */
  region: [number, number, number, number] | null;
  label: string;
};

export function SourceRegion({ sourceUrl, page, region, label }: Props): ReactNode {
  const { dictionary } = useI18n();
  const labels = dictionary.review.source;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [wholePage, setWholePage] = useState(region === null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setState("loading");
        const pdf = await loadDocument(sourceUrl);
        const pdfPage = await pdf.getPage(page);
        const scale = REVIEW_RENDER_SCALE * (window.devicePixelRatio || 1);
        const viewport = pdfPage.getViewport({ scale });
        const full = document.createElement("canvas");
        full.width = Math.ceil(viewport.width);
        full.height = Math.ceil(viewport.height);
        await pdfPage.render({ canvas: full, viewport }).promise;
        const target = canvasRef.current;
        if (cancelled || !target) return;
        const context = target.getContext("2d");
        if (!context) throw new Error("no 2d context");
        if (wholePage || !region) {
          target.width = full.width;
          target.height = full.height;
          context.drawImage(full, 0, 0);
          if (region) {
            context.strokeStyle = "rgba(200, 30, 30, 0.9)";
            context.lineWidth = Math.max(2, scale);
            context.strokeRect(region[0] * scale, region[1] * scale, (region[2] - region[0]) * scale, (region[3] - region[1]) * scale);
          }
        } else {
          const x = Math.floor(region[0] * scale);
          const y = Math.floor(region[1] * scale);
          const width = Math.min(full.width - x, Math.ceil((region[2] - region[0]) * scale));
          const height = Math.min(full.height - y, Math.ceil((region[3] - region[1]) * scale));
          target.width = width;
          target.height = height;
          context.drawImage(full, x, y, width, height, 0, 0, width, height);
        }
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sourceUrl, page, region, wholePage]);

  return (
    <figure className="source-region">
      <figcaption className="source-region__caption">
        <span>{labels.page.replace("{page}", String(page))}</span>
        {region && (
          <button type="button" className="button-secondary" onClick={() => setWholePage((value) => !value)} aria-pressed={wholePage}>
            {wholePage ? labels.regionOnly : labels.wholePage}
          </button>
        )}
      </figcaption>
      {state === "loading" && <p className="source-region__status" aria-live="polite">{labels.loading}</p>}
      {state === "error" && <p className="action-feedback--error" role="alert">{labels.error}</p>}
      {/* On narrow screens the region keeps a readable size and scrolls inside its frame, never the page (P-14). */}
      <div className="source-region__scroll" tabIndex={state === "ready" ? 0 : -1} aria-label={label}>
        <canvas ref={canvasRef} className="source-region__canvas" role="img" aria-label={label} hidden={state !== "ready"} />
      </div>
    </figure>
  );
}
