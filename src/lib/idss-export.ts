/**
 * The uniform IDSS export format (PDL-036): CSV for spreadsheet programs (semicolon separated, CRLF, UTF-8 BOM) whose
 * first rows always name the product, the document, the export time and, for personal data, the confidentiality line;
 * one empty row, then the table. Cells are safe against formula injection (DONE_CHECKLIST).
 */

export type ExportCell = string | number | null;

/** One CSV cell: text starting with =, +, -, @, tab or carriage return gets an apostrophe; quotes doubled; always quoted. */
export function csvCell(value: ExportCell): string {
  const text = value === null ? "" : String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** A CSV document from rows. */
export function toCsv(rows: readonly (readonly ExportCell[])[]): string {
  return "﻿" + rows.map((row) => row.map(csvCell).join(";")).join("\r\n") + "\r\n";
}

export type ExportHeading = { product: string; title: string; exportedAt: string; confidential: string | null };

/** A CSV document in the IDSS format: heading rows, an empty row, then the table. */
export function toIdssCsv(heading: ExportHeading, rows: readonly (readonly ExportCell[])[]): string {
  const head: ExportCell[][] = [[heading.product], [heading.title], [heading.exportedAt]];
  if (heading.confidential) head.push([heading.confidential]);
  return toCsv([...head, [], ...rows]);
}

/** A file name in the IDSS format: idss-<document>-<YYYY-MM-DD>.csv with only safe characters. */
export function exportFileName(document: string, day: string): string {
  const slug = document.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `idss-${slug || "izvoz"}-${day}.csv`;
}
