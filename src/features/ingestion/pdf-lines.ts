import { OPS, getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { TextItem } from "pdfjs-dist/types/src/display/api";

/**
 * PDF text layer as visual lines (the model the parser profiles work on). Built on pdf.js
 * (Apache-2.0): text items are joined in content order and split where pdf.js marks an end of
 * line or the baseline moves. No OCR, no AI, no normalisation of the canonical text (P-4):
 * characters are kept exactly as the PDF encodes them (`disableNormalization`).
 */

/** One visual text line with its location (1-based page, PDF points, origin top-left). */
export type PdfLine = {
  page: number;
  text: string;
  bbox: [number, number, number, number];
  /** Non-blank runs with their emphasis, derived from the font name (e.g. "TimesNewRomanPS-BoldItalicMT"). */
  runs: { text: string; bold: boolean; italic: boolean }[];
};

export type PdfText = {
  pageCount: number;
  pageHeights: number[];
  /** Lines of every page in reading order as encoded in the PDF. */
  pages: PdfLine[][];
  /** 1-based numbers of pages that draw at least one image (figures, graphical answer options). */
  imagePages: number[];
};

const IMAGE_OPERATORS = new Set<number>([OPS.paintImageXObject, OPS.paintInlineImageXObject, OPS.paintImageMaskXObject]);
const BOLD_FONT = /bold|black|heavy/i;
const ITALIC_FONT = /italic|oblique/i;

/**
 * Baseline shift, in font sizes, that still counts as the same line when the text continues to
 * the right: exponents, indices and footnote markers sit up to half a font size off the baseline
 * (measured: 0.49), while consecutive lines are about 1.5 font sizes apart.
 */
const SCRIPT_SHIFT_FONT_SIZES = 0.55;
/**
 * A horizontal gap wider than this many font sizes (a tab stop, a column) starts a new line.
 * Measured on the three catalogues against the Sprint 00 reference extraction (PyMuPDF), whose
 * line model splits there: gaps up to 1.0 font size were never split, from 1.1 almost always.
 */
const LINE_GAP_FONT_SIZES = 1.05;

type Pending = { page: number; baseline: number; items: { item: TextItem; ascent: number; descent: number }[] };

function finishLine(pending: Pending, pageHeight: number, fontNames: Map<string, string>): PdfLine | null {
  const text = pending.items.map(({ item }) => item.str).join("").trimEnd();
  if (!text.trim()) return null;
  const visible = pending.items.filter(({ item }) => item.str.trim().length > 0);
  const x0 = Math.min(...visible.map(({ item }) => item.transform[4]));
  const x1 = Math.max(...visible.map(({ item }) => item.transform[4] + item.width));
  const tops = visible.map(({ item, ascent }) => pageHeight - item.transform[5] - ascent * Math.abs(item.transform[3]));
  const bottoms = visible.map(({ item, descent }) => pageHeight - item.transform[5] - descent * Math.abs(item.transform[3]));
  const round = (value: number) => Math.round(value * 10) / 10;
  return {
    page: pending.page,
    text,
    bbox: [round(x0), round(Math.min(...tops)), round(x1), round(Math.max(...bottoms))],
    runs: visible.map(({ item }) => {
      const name = fontNames.get(item.fontName) ?? "";
      return { text: item.str, bold: BOLD_FONT.test(name), italic: ITALIC_FONT.test(name) };
    }),
  };
}

/**
 * Read the text layer of a PDF.
 * @param data file bytes (not modified)
 * @throws when the bytes are not a readable PDF
 */
export async function readPdfText(data: Uint8Array): Promise<PdfText> {
  const loading = getDocument({ data: data.slice(), disableFontFace: true, useSystemFonts: false, verbosity: 0 });
  const document = await loading.promise;
  try {
    const pages: PdfLine[][] = [];
    const pageHeights: number[] = [];
    const imagePages: number[] = [];
    for (let number = 1; number <= document.numPages; number += 1) {
      const page = await document.getPage(number);
      const height = page.getViewport({ scale: 1 }).height;
      pageHeights.push(height);
      // The operator list loads the page's fonts (names give emphasis) and shows its images.
      const operators = await page.getOperatorList();
      if (operators.fnArray.some((operator) => IMAGE_OPERATORS.has(operator))) imagePages.push(number);
      const content = await page.getTextContent({ disableNormalization: true });
      const fontNames = new Map<string, string>();
      for (const fontId of Object.keys(content.styles)) {
        const font = page.commonObjs.has(fontId) ? (page.commonObjs.get(fontId) as { name?: string } | null) : null;
        if (font?.name) fontNames.set(fontId, font.name);
      }
      const lines: PdfLine[] = [];
      let pending: Pending | null = null;
      let breakBefore = false;
      const items = content.items.filter((raw): raw is TextItem => "str" in raw);
      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        const style = content.styles[item.fontName];
        const baseline = height - item.transform[5];
        const fontSize = Math.abs(item.transform[3]) || Math.abs(item.transform[0]);
        const isBreakMarker = item.str === "" && item.hasEOL;
        // A whitespace item as wide as a tab stop separates two lines (it belongs to neither).
        // Gaps are measured against the largest font of the line, so a small raised footnote
        // marker ("³ Ispitni centar …") does not split its line.
        const lineSize = Math.max(fontSize, ...(pending?.items.map(({ item: other }) => Math.abs(other.transform[3])) ?? [0]));
        const isWideGap = item.str.trim() === "" && item.str !== "" && lineSize > 0 && item.width > LINE_GAP_FONT_SIZES * lineSize;
        const previous = pending?.items.at(-1)?.item;
        const previousEnd = previous ? previous.transform[4] + previous.width : 0;
        const jump = previous && lineSize > 0 ? item.transform[4] - previousEnd > LINE_GAP_FONT_SIZES * lineSize : false;
        const continuesRight = previous ? item.transform[4] >= previousEnd - 1 : false;
        const sameLine = pending ? Math.abs(pending.baseline - baseline) <= SCRIPT_SHIFT_FONT_SIZES * lineSize && continuesRight : false;
        if (!isBreakMarker && pending && (breakBefore || jump || !sameLine)) {
          const line = finishLine(pending, height, fontNames);
          if (line) lines.push(line);
          pending = null;
        }
        breakBefore = item.hasEOL || isWideGap;
        if (isBreakMarker || isWideGap) continue;
        if (!pending) pending = { page: number, baseline, items: [] };
        pending.items.push({ item, ascent: style?.ascent ?? 0.8, descent: style?.descent ?? -0.2 });
      }
      if (pending) {
        const line = finishLine(pending, height, fontNames);
        if (line) lines.push(line);
      }
      pages.push(lines);
      page.cleanup();
    }
    return { pageCount: document.numPages, pageHeights, pages, imagePages };
  } finally {
    await loading.destroy();
  }
}
