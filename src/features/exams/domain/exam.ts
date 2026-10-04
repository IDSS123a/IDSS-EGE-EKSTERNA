import type { ExamUnit } from "../types";

/**
 * Mock exam rules for the screens (framework-free, M-5). The database is the authority on time and points; these
 * helpers only present what it returns.
 */

/** Offset between the server clock and the browser clock, measured when the exam was loaded. */
export function clockOffsetMs(serverNow: string, clientNowMs: number): number {
  const server = Date.parse(serverNow);
  return Number.isNaN(server) ? 0 : server - clientNowMs;
}

/** Milliseconds left until the deadline on the server clock (never negative). */
export function remainingMs(deadlineAt: string, clientNowMs: number, offsetMs: number): number {
  const deadline = Date.parse(deadlineAt);
  return Number.isNaN(deadline) ? 0 : Math.max(0, deadline - (clientNowMs + offsetMs));
}

/** A countdown as h:mm:ss or mm:ss. */
export function formatClock(ms: number): string {
  const total = Math.ceil(Math.max(0, ms) / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const two = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${two(minutes)}:${two(seconds)}` : `${two(minutes)}:${two(seconds)}`;
}

/** One position of the blueprint with its questions in exam order, each with the units answered on it. */
export type ExamPosition = { position: number; questions: { questionVersionId: string; units: ExamUnit[] }[] };

/** Units grouped by blueprint position, then by question, in the exam's sequence. */
export function groupByPosition(units: readonly ExamUnit[]): ExamPosition[] {
  const positions: ExamPosition[] = [];
  for (const unit of [...units].sort((a, b) => a.sequence - b.sequence)) {
    let position = positions.find((entry) => entry.position === unit.position);
    if (!position) {
      position = { position: unit.position, questions: [] };
      positions.push(position);
    }
    let question = position.questions.find((entry) => entry.questionVersionId === unit.questionVersionId);
    if (!question) {
      question = { questionVersionId: unit.questionVersionId, units: [] };
      position.questions.push(question);
    }
    question.units.push(unit);
  }
  return positions;
}

/** How many units have an answer. */
export function answeredCount(responses: Readonly<Record<string, string>>): number {
  return Object.values(responses).filter((response) => response.trim() !== "").length;
}

/**
 * Points with at most two decimals and the reader's decimal mark (0,5 in Bosnian and German, 0.5 in English). Written
 * by hand, not with Intl: browsers without Bosnian locale data would render differently from the server (hydration).
 */
export function formatPoints(points: number, locale: string): string {
  const text = String(Math.round(points * 100) / 100);
  return locale === "en" ? text : text.replace(".", ",");
}

/** "Dio testa: pozicije 6, 7" for a part a teacher sent (PDL-043), the whole-test label otherwise. */
export function testLabel(kind: "full" | "part", positions: readonly number[] | null, labels: { full: string; part: string }): string {
  return kind === "part" && positions && positions.length > 0 ? labels.part.replace("{positions}", [...positions].sort((a, b) => a - b).join(", ")) : labels.full;
}
