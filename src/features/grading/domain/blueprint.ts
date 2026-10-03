import type { BlueprintPool } from "../types";

/**
 * Presentation of blueprint ranges (framework-free, M-5). A pool key is a regular expression over record keys with one
 * group for the task number; reviewers read it as the first and last record key of the range.
 */

/** The first and last record key a pool admits, e.g. DEU-4.1.1 and DEU-4.1.10; "x" stands for any area number. */
export function poolRange(pool: BlueprintPool): { first: string; last: string } {
  const pattern = pool.key.replace(/^\^/, "").replace(/\$$/, "").replace(/\[0-9\]\+(?!\))/g, "x").replace(/\\\./g, ".");
  const at = (n: number) => pattern.replace("([0-9]+)", String(n));
  return { first: at(pool.from), last: at(pool.to) };
}

/** Allowed numbers of correct pairs of a matching unit, ascending (keys of the confirmed rule). */
export function pairChoices(rule: Readonly<Record<string, number>> | null): number[] {
  return rule ? Object.keys(rule).map(Number).filter(Number.isInteger).sort((a, b) => a - b) : [];
}
