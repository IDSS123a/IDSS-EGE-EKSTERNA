import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sha256Hex } from "@/features/canon/domain";
import { extractCatalogue } from "@/features/ingestion/domain/extract";
import { profileForSha256 } from "@/features/ingestion/domain/profiles";
import type { CatalogueRecord } from "@/features/ingestion/types";

/**
 * Sprint 03 exit criterion: the TypeScript extractor reproduces the Sprint 00 reference
 * extraction (tools/canon-ingestion/output, PyMuPDF) for all three catalogues: identical record
 * IDs in identical order, identical structure, status and flags, and identical canonical text,
 * answer keys, options and scored items. Text is compared without whitespace, the one known
 * difference between the two PDF libraries (pdf.js collapses repeated spaces and spaces math
 * operators, PyMuPDF keeps the raw spacing); no character of content may differ.
 */
const ROOT = join(__dirname, "../..");
const CATALOGUES = [
  { file: "matematika_-_katalog.pdf", reference: "mathematics", units: 200, scored: 200 },
  { file: "bjk_hjk_sjk_katalog_eksterna_matura_2022_2023.pdf", reference: "bhs_language_literature", units: 220, scored: 200 },
  { file: "Ispitni katalog za Njemački jezik.pdf", reference: "german", units: 80, scored: 200 },
];

const text = (value: string | null | undefined) => (value ?? "").replace(/\s/gu, "");

/** The comparable content of a record: everything except positions, timestamps and document metadata. */
function comparable(record: CatalogueRecord) {
  return {
    id: record.id,
    kind: record.record_kind,
    pages: record.source.pages,
    section: record.source.section_path.map(text),
    raw: text(record.syntax.raw_text),
    stem: text(record.syntax.stem_text),
    options: record.syntax.options.map((option) => [option.label, text(option.text)]),
    emphasis: text(record.syntax.emphasis_spans.map((span) => span.text).join("")),
    figure: record.syntax.has_figure_reference,
    fidelity: record.syntax.notation_fidelity,
    type: record.logic.task_type ?? null,
    subParts: record.logic.sub_parts ?? null,
    key: text(record.logic.answer_key_raw),
    items: (record.logic.scored_items ?? []).map((item) => [item.item_number, text(item.raw_text), text(item.answer_key_raw), (item.options ?? []).map((option) => [option.label, text(option.text)])]),
    area: text(record.semantics.area),
    level: record.semantics.catalogue_level ?? null,
    stimulus: record.stimulus ? text(record.stimulus.transcript_raw_text) : null,
    status: record.validation.structural_status,
    issues: [...record.validation.issues].sort(),
    trust: record.validation.trust_status,
  };
}

describe("catalogue ingestion reproduces the Sprint 00 reference", () => {
  for (const catalogue of CATALOGUES) {
    it(`${catalogue.reference}: ${catalogue.units} units, identical IDs, keys and content`, async () => {
      const data = new Uint8Array(readFileSync(join(ROOT, catalogue.file)));
      const sha256 = await sha256Hex(data);
      const profile = profileForSha256(sha256);
      expect(profile, "a reviewed parser profile exists for this edition").not.toBeNull();
      const result = await extractCatalogue(data, { file: catalogue.file, sha256, official_title: "", issuing_authority: "", version_id: null }, profile!, "2026-01-01T00:00:00Z");
      const reference = JSON.parse(readFileSync(join(ROOT, "tools/canon-ingestion/output", `${catalogue.reference}.questions.json`), "utf8")) as { records: CatalogueRecord[] };

      expect(result.records.map((record) => record.id)).toEqual(reference.records.map((record) => record.id));
      expect(result.records).toHaveLength(catalogue.units);
      const scored = result.records.filter((record) => record.record_kind !== "official_catalogue_supplementary_task").reduce((sum, record) => sum + (record.logic.scored_item_count ?? 1), 0);
      expect(scored).toBe(catalogue.scored);
      result.records.forEach((record, index) => expect(comparable(record), record.id).toEqual(comparable(reference.records[index])));
      expect(result.records.every((record) => record.validation.trust_status === "untrusted_pending_review")).toBe(true);
    }, 120_000);
  }

  it("refuses an edition without a reviewed parser profile", () => {
    expect(profileForSha256("0".repeat(64))).toBeNull();
  });
});
