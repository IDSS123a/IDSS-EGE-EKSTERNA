import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sha256Hex } from "@/features/canon/domain";
import { readPdfText } from "@/features/ingestion/pdf-lines";
import { allEditionFacts, factsForSha256, missingQuotes, normalizeForQuote } from "@/features/knowledge/domain/facts";

/**
 * PDL-015: every subject and rule quote in config/canonical-facts.json is verbatim text of the
 * bound catalogue edition, on the stated page.
 */
const ROOT = join(__dirname, "../..");

describe("canonical facts", () => {
  it("has one edition per exam subject, each with rules", () => {
    const codes = allEditionFacts().map((edition) => edition.subject.code).sort();
    expect(codes).toEqual(["bhs_language_literature", "german", "mathematics"]);
    for (const edition of allEditionFacts()) {
      const ruleCodes = edition.rules.map((rule) => rule.code);
      expect(new Set(ruleCodes).size).toBe(ruleCodes.length);
      expect(ruleCodes).toContain("exam.duration_minutes");
      expect(ruleCodes).toContain("exam.total_points");
    }
  });

  it("normalizes whitespace only", () => {
    expect(normalizeForQuote(" a\n b\t c ")).toBe("a b c");
  });

  for (const edition of allEditionFacts()) {
    it(`finds every quote on its page: ${edition.file}`, async () => {
      const bytes = new Uint8Array(readFileSync(join(ROOT, edition.file)));
      expect(await sha256Hex(bytes)).toBe(edition.sha256);
      expect(factsForSha256(edition.sha256)).toBe(edition);
      const pdf = await readPdfText(bytes);
      expect(missingQuotes(edition, pdf)).toEqual([]);
    });
  }

  it("rejects a quote that is not on its page", async () => {
    const edition = allEditionFacts()[0];
    const bytes = new Uint8Array(readFileSync(join(ROOT, edition.file)));
    const pdf = await readPdfText(bytes);
    const altered = { ...edition, rules: [{ ...edition.rules[0], evidence: [{ page: edition.rules[0].evidence[0].page, quote: "Na ispitu, koji traje 90 minuta" }] }] };
    expect(missingQuotes(altered, pdf)).toHaveLength(1);
    const moved = { ...edition, rules: [{ ...edition.rules[0], evidence: [{ ...edition.rules[0].evidence[0], page: 1 }] }] };
    expect(missingQuotes(moved, pdf)).toHaveLength(1);
  });
});
