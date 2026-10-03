import type { OverviewStudent, Readiness } from "../types";

/**
 * Support monitoring presentation rules (framework-free, M-5). Facts only: shares, day counts and comparisons with the
 * student's own earlier results. No function here turns data into a label about a student (P-4, mandate §11).
 */

/** Whole percent of a part, null when nothing was checked (shown as "nema podataka", never as 0 %). */
export function share(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}

/** Days from the last activity to today (dates as YYYY-MM-DD or ISO), null without any activity. */
export function daysSince(lastActivity: string | null, today: string): number | null {
  if (!lastActivity) return null;
  const last = Date.parse(lastActivity.slice(0, 10) + "T12:00:00Z");
  const now = Date.parse(today.slice(0, 10) + "T12:00:00Z");
  return Number.isNaN(last) || Number.isNaN(now) ? null : Math.max(0, Math.round((now - last) / 86_400_000));
}

/** User-set filter: no practice in the last N days (N chosen by the user; students without any activity included). */
export function withoutPracticeFor(student: OverviewStudent, days: number, today: string): boolean {
  const since = daysSince(student.lastActivity, today);
  return since === null || since >= days;
}

/** Factual comparison: in some subject the latest graded mock exam has fewer points than the one before. */
export function droppedAgainstOwnPrevious(student: OverviewStudent): boolean {
  return student.subjects.some((subject) => subject.exams.length >= 2 && subject.exams[0].points < subject.exams[1].points);
}

/** Readiness as a percentage text, or null when the state has no number (PDL-032). */
export function readinessPercent(readiness: Readiness): number | null {
  return readiness.state === "100" ? 100 : readiness.state === "90" ? 90 : readiness.state === "80" ? 80 : null;
}

/**
 * One CSV cell, safe against formula injection (DONE_CHECKLIST): text starting with =, +, -, @, tab or carriage return
 * is prefixed with an apostrophe; quotes are doubled and every cell is quoted.
 */
export function csvCell(value: string | number | null): string {
  const text = value === null ? "" : String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** A CSV document (semicolon separated for local spreadsheet programs, CRLF line ends, BOM for UTF-8). */
export function toCsv(rows: readonly (readonly (string | number | null)[])[]): string {
  return "﻿" + rows.map((row) => row.map(csvCell).join(";")).join("\r\n") + "\r\n";
}
