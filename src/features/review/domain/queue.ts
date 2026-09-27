import type { QueueFilter, QueueItem, ReviewState } from "../types";

/**
 * Review queue rules, framework-free. A record's state follows its decisions: accepted once
 * accepted (under any job of the version, keyed by record key), else the latest decision, else pending.
 */

/** State of one record key from its decisions (any order). */
export function reviewState(decisions: readonly { decision: "accepted" | "returned"; decidedAt: string }[]): ReviewState {
  if (decisions.some((entry) => entry.decision === "accepted")) return "accepted";
  return decisions.length > 0 ? "returned" : "pending";
}

/** Counts per state. */
export function countStates(items: readonly QueueItem[]): Record<ReviewState, number> {
  const counts: Record<ReviewState, number> = { pending: 0, returned: 0, accepted: 0 };
  for (const item of items) counts[item.state] += 1;
  return counts;
}

/** Items matching the filter, in source order. */
export function filterQueue(items: readonly QueueItem[], filter: QueueFilter): QueueItem[] {
  return items.filter((item) => filter === "all" || item.state === filter).sort((a, b) => a.ordinal - b.ordinal);
}

/** One page (1-based) of a filtered list and the page count. */
export function pageOf<T>(items: readonly T[], page: number, size: number): { items: T[]; page: number; pages: number } {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, Math.trunc(page) || 1), pages);
  return { items: items.slice((current - 1) * size, current * size), page: current, pages };
}

/** The record before and after the given one in the filtered queue (for review navigation). */
export function neighbours(items: readonly QueueItem[], recordId: number): { previous: number | null; next: number | null } {
  const index = items.findIndex((item) => item.recordId === recordId);
  if (index < 0) return { previous: null, next: items[0]?.recordId ?? null };
  return { previous: items[index - 1]?.recordId ?? null, next: items[index + 1]?.recordId ?? null };
}

/** Parse the queue filter from a search parameter (unknown values mean "pending"). */
export function parseFilter(value: string | undefined): QueueFilter {
  return value === "returned" || value === "accepted" || value === "all" ? value : "pending";
}

/**
 * Region of the page to show beside a record: the union of its regions on one page, widened by a
 * margin (PDF points) so the reviewer sees the surrounding context, clamped to the page.
 */
export function regionOnPage(regions: readonly { page: number; bbox: [number, number, number, number] }[], page: number, margin: number): [number, number, number, number] | null {
  const boxes = regions.filter((region) => region.page === page).map((region) => region.bbox);
  if (boxes.length === 0) return null;
  const x0 = Math.min(...boxes.map((box) => box[0])) - margin;
  const y0 = Math.min(...boxes.map((box) => box[1])) - margin;
  const x1 = Math.max(...boxes.map((box) => box[2])) + margin;
  const y1 = Math.max(...boxes.map((box) => box[3])) + margin;
  return [Math.max(0, x0), Math.max(0, y0), x1, y1];
}
