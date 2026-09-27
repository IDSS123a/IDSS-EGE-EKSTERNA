import type { PdfLine, PdfText } from "../pdf-lines";
import type { CanonicalDocumentInfo, CatalogueRecord, EmphasisSpan, McOption, Region, StructuralStatus } from "../types";

/**
 * Building blocks shared by the catalogue parser profiles (port of the Sprint 00 reference tool
 * `tools/canon-ingestion/extract_catalogues.py`, whose outputs are the regression reference).
 * Deterministic, no AI, no OCR; canonical text is never paraphrased (P-4): `raw_text` is the PDF
 * text layer as extracted, lines joined with "\n".
 */

/** Extractor identity recorded on every record and job. */
export const EXTRACTOR = "src/features/ingestion";
/** Version of the extraction rules; bump when any profile or rule changes its output. */
export const EXTRACTOR_VERSION = "1.0.0";
/** How records were produced (provenance shown to reviewers). */
export const EXTRACTION_METHOD = "pdf.js text layer + deterministic segmentation (no AI, no OCR)";

/** Height of the footer band (points) measured on the catalogues: running footer and page number. */
const FOOTER_BAND_POINTS = 75;

/**
 * Word boundary that treats every Unicode letter as a word character (Python 3 `\b` semantics;
 * JavaScript `\b` only knows ASCII letters, which breaks on č, ć, š, ž, đ).
 */
export const WORD_START = "(?<![\\p{L}\\p{N}_])";

/** Notation the PDF text layer cannot represent faithfully (stacked fractions, exponents, radicals). */
export const MATH_LAYOUT_MARKERS = /[√∙⋅∶±≠≤≥°²³∈∉⊂∪∩π]|[\u{1D400}-\u{1D7FF}]/u;
/** Wording that points to a drawing or table the text layer cannot carry. */
export const FIGURE_REFERENCE = new RegExp(`${WORD_START}(crtež|crtežu|slici|slika|sliku|grafik|grafiku|tabel|shem)`, "iu");
/** A multiple-choice option line "a) …" to "d) …". */
export const MC_OPTION = /^\s*([a-d])\)\s*(.*)$/u;

/** Body lines of an inclusive 1-based page range, without running headers and footers. */
export function readLines(pdf: PdfText, firstPage: number, lastPage: number, headerBand: number): PdfLine[] {
  const lines: PdfLine[] = [];
  for (let page = firstPage; page <= Math.min(lastPage, pdf.pageCount); page += 1) {
    const footerLimit = pdf.pageHeights[page - 1] - FOOTER_BAND_POINTS;
    for (const line of pdf.pages[page - 1]) {
      const [, y0, , y1] = line.bbox;
      if (y1 <= headerBand || y0 >= footerLimit) continue;
      if (!line.text.trim()) continue;
      lines.push(line);
    }
  }
  return lines;
}

/** Join line texts with newlines in source order. */
export function joined(lines: readonly PdfLine[]): string {
  return lines.map((line) => line.text).join("\n").trim();
}

/** One bounding region per page, for rendering the original source region to reviewers. */
export function regionsOf(lines: readonly PdfLine[]): Region[] {
  const byPage = new Map<number, [number, number, number, number]>();
  for (const line of lines) {
    const box = byPage.get(line.page) ?? [Infinity, Infinity, -Infinity, -Infinity];
    box[0] = Math.min(box[0], line.bbox[0]);
    box[1] = Math.min(box[1], line.bbox[1]);
    box[2] = Math.max(box[2], line.bbox[2]);
    box[3] = Math.max(box[3], line.bbox[3]);
    byPage.set(line.page, box);
  }
  return [...byPage.entries()].sort(([a], [b]) => a - b).map(([page, bbox]) => ({ page, bbox: bbox.map((value) => Math.round(value * 10) / 10) as Region["bbox"] }));
}

/** A contiguous run of lines belonging to one catalogue question or task. */
export type Segment = { originalNumber: string; sectionPath: string[]; lines: PdfLine[] };

/**
 * Generic segmenter: `section` returns a new section path for heading lines (which belong to no
 * segment); `start` opens a new segment; every other line continues the current segment.
 */
export function segmentBy(
  lines: readonly PdfLine[],
  start: (line: PdfLine, path: string[]) => { number: string; path: string[] } | null,
  section: (line: PdfLine) => string[] | null,
): Segment[] {
  const segments: Segment[] = [];
  let path: string[] = [];
  let current: Segment | null = null;
  for (const line of lines) {
    const newPath = section(line);
    if (newPath !== null) {
      path = newPath;
      current = null;
      continue;
    }
    const opened = start(line, path);
    if (opened) {
      current = { originalNumber: opened.number, sectionPath: opened.path, lines: [line] };
      segments.push(current);
    } else if (current) {
      current.lines.push(line);
    }
  }
  return segments;
}

/** Split a multiple-choice question into stem lines and a) .. d) options (continuation lines appended). */
export function splitOptions(lines: readonly PdfLine[]): { stem: PdfLine[]; options: McOption[] } {
  const stem: PdfLine[] = [];
  const options: McOption[] = [];
  for (const line of lines) {
    const match = MC_OPTION.exec(line.text);
    const previous = options.at(-1);
    const isNext = match !== null && (previous ? match[1].charCodeAt(0) === previous.label.charCodeAt(0) + 1 : match[1] === "a");
    if (match && isNext) options.push({ label: match[1], text: match[2].trim() });
    else if (previous) previous.text = `${previous.text}\n${line.text.trim()}`.trim();
    else stem.push(line);
  }
  return { stem, options };
}

function emphasisOf(lines: readonly PdfLine[]): EmphasisSpan[] {
  return lines.flatMap((line) => line.runs.filter((run) => run.bold || run.italic).map((run) => ({ text: run.text, bold: run.bold, italic: run.italic, page: line.page })));
}

/** Common record skeleton with the syntax and provenance layers filled. */
export function baseRecord(document: CanonicalDocumentInfo, subject: string, segment: Segment, idPrefix: string): CatalogueRecord {
  const rawText = joined(segment.lines);
  const issues: string[] = [];
  let fidelity: CatalogueRecord["syntax"]["notation_fidelity"] = "text_layer_ok";
  if (MATH_LAYOUT_MARKERS.test(rawText) || /^\s*\d+\s*$/m.test(rawText)) {
    fidelity = "requires_visual_verification";
    issues.push("2-D notation (fractions/exponents/radicals) not representable in PDF text layer");
  }
  const hasFigure = FIGURE_REFERENCE.test(rawText);
  if (hasFigure) issues.push("references a figure/table: stimulus must be taken from the rendered source region");
  return {
    id: `${idPrefix}-${segment.originalNumber}`,
    subject,
    record_kind: "official_catalogue_question",
    canonical_document: document,
    source: {
      original_number: segment.originalNumber,
      section_path: segment.sectionPath,
      pages: [...new Set(segment.lines.map((line) => line.page))].sort((a, b) => a - b),
      regions: regionsOf(segment.lines),
    },
    syntax: { raw_text: rawText, stem_text: null, options: [], emphasis_spans: emphasisOf(segment.lines), has_figure_reference: hasFigure, notation_fidelity: fidelity },
    logic: {},
    semantics: {},
    validation: { structural_status: "pending", issues, trust_status: "untrusted_pending_review", semantic_review_status: "not_started" },
    provenance: { extractor: EXTRACTOR, extractor_version: EXTRACTOR_VERSION, method: EXTRACTION_METHOD, extracted_at: null },
  };
}

/** Structural gate: "passed", "passed_with_flags" (issues for reviewers) or "failed" (reason recorded). */
export function finaliseStructural(record: CatalogueRecord, requiredOk: boolean, reason?: string): void {
  const validation = record.validation;
  let status: StructuralStatus;
  if (!requiredOk) {
    status = "failed";
    if (reason) validation.issues.push(reason);
  } else {
    status = validation.issues.length > 0 ? "passed_with_flags" : "passed";
  }
  validation.structural_status = status;
}

/** Escape text for use inside a RegExp source. */
export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
