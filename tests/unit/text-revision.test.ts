import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CatalogueRecord } from "@/features/ingestion/types";
import { readPdfText } from "@/features/ingestion/pdf-lines";
import { normalizeForQuote } from "@/features/knowledge/domain/facts";
import { allTextProposals, applyProposal, proposedText, sameText, type QuestionText } from "@/features/review/domain/text-revision";

/**
 * AMB-19 / PDL-021: every proposed text revision removes only footnote text that is printed on the
 * stated page, and leaves the task text itself unchanged.
 */
const ROOT = join(__dirname, "../..");
const MATH_PDF = "Ispitni katalog za Matematika.pdf";
const records = (JSON.parse(readFileSync(join(ROOT, "tools/canon-ingestion/output/mathematics.questions.json"), "utf8")) as { records: CatalogueRecord[] }).records;

function textOf(record: CatalogueRecord): QuestionText {
  return {
    rawText: record.syntax.raw_text,
    stemText: record.syntax.stem_text,
    options: record.syntax.options.map((option) => ({ label: option.label, text: option.text })),
    scoredItems: (record.logic.scored_items ?? []).map((item) => ({ itemNumber: item.item_number, rawText: item.raw_text })),
  };
}

describe("question text revision proposals", () => {
  it("covers the five Math questions of AMB-19 and not the German web address, which is task text", () => {
    expect(allTextProposals().map((proposal) => proposal.record_key)).toEqual(["MAT-5.3.5", "MAT-5.4.20", "MAT-5.9.13", "MAT-5.10.6", "MAT-5.10.20"]);
  });

  for (const proposal of allTextProposals()) {
    it(`removes only footnote text: ${proposal.record_key}`, async () => {
      const record = records.find((candidate) => candidate.id === proposal.record_key);
      expect(record).toBeDefined();
      if (!record) return;
      expect(record.source.pages).toContain(proposal.page);
      const current = textOf(record);
      const revised = applyProposal(current, proposal);
      expect(revised).not.toBeNull();
      if (!revised) return;
      expect(sameText(current, revised)).toBe(false);
      for (const field of [revised.rawText, revised.stemText ?? "", ...revised.options.map((option) => option.text)]) {
        expect(field).not.toMatch(/pristupljeno|https?:\/\//);
      }
      // The task line itself stays: the revised text is the start of the extracted text, apart from the marker.
      expect(revised.rawText.split("\n")[0].replace(/\.\s*$/, "")).toBe(current.rawText.split("\n")[0].replace(/\.[0-9]$/, "").replace(/\.\s*$/, ""));

      // Every removed footnote is printed on the stated page and starts with its footnote number.
      const pdf = await readPdfText(new Uint8Array(readFileSync(join(ROOT, MATH_PDF))));
      const page = normalizeForQuote(pdf.pages[proposal.page - 1].map((line) => line.text).join(" "));
      const removed = proposal.replacements.filter((replacement) => replacement.replace === "").map((replacement) => normalizeForQuote(replacement.find));
      for (const footnote of removed) {
        expect(proposal.footnotes.some((number) => footnote.startsWith(`${number} `))).toBe(true);
        expect(page).toContain(footnote.replace(/^[0-9]+ /, ""));
      }
    });
  }

  it("offers nothing when the stored text is not the one the proposal was prepared from", () => {
    const text: QuestionText = { rawText: "5.3.5. Koja je vrijednost izraza?", stemText: null, options: [], scoredItems: [] };
    expect(proposedText("MAT-5.3.5", text)).toBeNull();
    expect(proposedText("MAT-9.9.9", text)).toBeNull();
  });

  it("matches any run of spaces and keeps labels and item numbers", () => {
    const proposal = allTextProposals()[0];
    const text: QuestionText = {
      rawText: "5.3.5. Tekst\n1 https://www.ncvvo.hr/drzavna-matura-2019-2019-ljetni-rok/,  pristupljeno, 1.8.2022. g.",
      stemText: "5.3.5. Tekst",
      options: [{ label: "d", text: "x\n1 https://www.ncvvo.hr/drzavna-matura-2019-2019-ljetni-rok/, pristupljeno, 1.8.2022. g." }],
      scoredItems: [{ itemNumber: 3, rawText: "y" }],
    };
    expect(applyProposal(text, proposal)).toEqual({ rawText: "5.3.5. Tekst", stemText: "5.3.5. Tekst", options: [{ label: "d", text: "x" }], scoredItems: [{ itemNumber: 3, rawText: "y" }] });
  });
});
