import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ingestionErrorFromDatabase } from "@/features/ingestion/domain/errors";
import { buildReport, countRecords, flagKey, groupFlags } from "@/features/ingestion/domain/report";
import { allProfiles } from "@/features/ingestion/domain/profiles";
import type { CatalogueRecord, ExtractionStats } from "@/features/ingestion/types";

const reference = (name: string) =>
  JSON.parse(readFileSync(join(__dirname, "../../tools/canon-ingestion/output", `${name}.questions.json`), "utf8")) as { records: CatalogueRecord[]; stats: ExtractionStats };

describe("ingestion report", () => {
  it("counts like the Sprint 00 ingestion report (INGESTION_REPORT.md summary)", () => {
    expect(countRecords(reference("mathematics").records)).toEqual({ units: 200, scored_units: 200, passed: 16, passed_with_flags: 184, failed: 0, with_answer_key: 200, supplementary: 0 });
    expect(countRecords(reference("bhs_language_literature").records)).toEqual({ units: 200, scored_units: 200, passed: 200, passed_with_flags: 0, failed: 0, with_answer_key: 200, supplementary: 20 });
    expect(countRecords(reference("german").records)).toEqual({ units: 80, scored_units: 200, passed: 70, passed_with_flags: 10, failed: 0, with_answer_key: 80, supplementary: 0 });
  });

  it("checks the declared total and lists what reviewers must look at", () => {
    const math = reference("mathematics");
    const report = buildReport(math.records, { ...math.stats, declared_total: 200 });
    expect(report.declared_total_matches).toBe(true);
    expect(report.structural_failures).toEqual([]);
    expect(report.missing_answer_keys).toEqual([]);
    expect(buildReport(math.records, { ...math.stats, declared_total: 199 }).declared_total_matches).toBe(false);
    expect(buildReport(math.records, { ...math.stats, declared_total: null }).declared_total_matches).toBeNull();
  });

  it("gives every flag the catalogues produce a translated key", () => {
    for (const name of ["mathematics", "bhs_language_literature", "german"]) {
      for (const record of reference(name).records) {
        for (const issue of record.validation.issues) expect(flagKey(issue), issue).not.toBe("other");
      }
    }
    expect(flagKey("expected 4 options a)–d), found 3")).toBe("structure");
    expect(flagKey("something new")).toBe("other");
    expect(groupFlags({ "no answer found in catalogue solutions chapter": 2, "answer key yields 3 value(s) for 4 item(s)": 5 })).toEqual([["keyCount", 5], ["noAnswer", 2]]);
  });

  it("maps database errors and never leaks unknown messages", () => {
    expect(ingestionErrorFromDatabase("FORBIDDEN")).toBe("FORBIDDEN");
    expect(ingestionErrorFromDatabase("INVALID_TRANSITION")).toBe("INVALID_TRANSITION");
    expect(ingestionErrorFromDatabase("duplicate key value violates unique constraint")).toBe("UNAVAILABLE");
  });

  it("binds every parser profile to exact files and valid page ranges", () => {
    for (const profile of allProfiles()) {
      expect(profile.applies_to_sha256.length).toBeGreaterThan(0);
      for (const sha256 of profile.applies_to_sha256) expect(sha256).toMatch(/^[0-9a-f]{64}$/u);
      for (const [first, last] of Object.values(profile.pages)) expect(first).toBeLessThanOrEqual(last);
    }
  });
});
