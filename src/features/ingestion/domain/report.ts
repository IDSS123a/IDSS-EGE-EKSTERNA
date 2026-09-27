import type { CatalogueRecord, ExtractionStats } from "../types";

/** Counts shown per ingestion job (same definitions as the Sprint 00 ingestion report). */
export type IngestionCounts = {
  units: number;
  scored_units: number;
  passed: number;
  passed_with_flags: number;
  failed: number;
  with_answer_key: number;
  supplementary: number;
};

/** Report stored with a job: extractor statistics plus what reviewers must look at. */
export type IngestionReport = {
  stats: ExtractionStats;
  flag_counts: Record<string, number>;
  structural_failures: { id: string; reason: string }[];
  missing_answer_keys: string[];
  declared_total_matches: boolean | null;
};

/** Records that count toward the declared catalogue question universe (not the supplementary tasks). */
function core(records: readonly CatalogueRecord[]): CatalogueRecord[] {
  return records.filter((record) => record.record_kind !== "official_catalogue_supplementary_task");
}

/** Scored units: German counts scored items, the other subjects count questions. */
export function scoredUnits(records: readonly CatalogueRecord[]): number {
  return core(records).reduce((sum, record) => sum + (record.logic.scored_item_count ?? 1), 0);
}

/** Counts of one extraction (the numbers the Director sees per job). */
export function countRecords(records: readonly CatalogueRecord[]): IngestionCounts {
  const base = core(records);
  const withStatus = (status: CatalogueRecord["validation"]["structural_status"]) => base.filter((record) => record.validation.structural_status === status).length;
  return {
    units: base.length,
    scored_units: scoredUnits(records),
    passed: withStatus("passed"),
    passed_with_flags: withStatus("passed_with_flags"),
    failed: withStatus("failed"),
    with_answer_key: base.filter((record) => Boolean(record.logic.answer_key_raw)).length,
    supplementary: records.length - base.length,
  };
}

/** The job report: flags by frequency, structural failures, missing keys, declared-total check. */
export function buildReport(records: readonly CatalogueRecord[], stats: ExtractionStats): IngestionReport {
  const base = core(records);
  const flagCounts: Record<string, number> = {};
  for (const record of base) for (const issue of record.validation.issues) flagCounts[issue] = (flagCounts[issue] ?? 0) + 1;
  return {
    stats,
    flag_counts: Object.fromEntries(Object.entries(flagCounts).sort(([, a], [, b]) => b - a)),
    structural_failures: base.filter((record) => record.validation.structural_status === "failed").map((record) => ({ id: record.id, reason: record.validation.issues.at(-1) ?? "" })),
    missing_answer_keys: base.filter((record) => !record.logic.answer_key_raw).map((record) => record.id),
    declared_total_matches: stats.declared_total === null ? null : scoredUnits(records) === stats.declared_total,
  };
}

/** Review flags as stable keys, so the interface can show them in the user's language (AMB-11, P-13). */
export type FlagKey = "notation" | "figure" | "graphicOptions" | "noAnswer" | "noAudio" | "supplementary" | "unclassified" | "keyCount" | "structure" | "other";

const FLAG_PATTERNS: [RegExp, FlagKey][] = [
  [/^2-D notation/u, "notation"],
  [/^references a figure/u, "figure"],
  [/^answer options are graphics/u, "graphicOptions"],
  [/^no answer found/u, "noAnswer"],
  [/^listening task/u, "noAudio"],
  [/^supplementary task/u, "supplementary"],
  [/^task type could not be derived/u, "unclassified"],
  [/^answer key yields/u, "keyCount"],
  [/^(expected \d|multiple choice expects|Wortschatz item expects)/u, "structure"],
];

/** Stable key of an extractor issue text (unknown texts map to "other"). */
export function flagKey(issue: string): FlagKey {
  return FLAG_PATTERNS.find(([pattern]) => pattern.test(issue))?.[1] ?? "other";
}

/** Flag counts grouped by key, largest first. */
export function groupFlags(flagCounts: Record<string, number>): [FlagKey, number][] {
  const grouped = new Map<FlagKey, number>();
  for (const [issue, count] of Object.entries(flagCounts)) grouped.set(flagKey(issue), (grouped.get(flagKey(issue)) ?? 0) + count);
  return [...grouped.entries()].sort(([, a], [, b]) => b - a);
}
