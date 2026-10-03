import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Question crops (P-15, PDL-027): every extracted catalogue question has its original page crop, bound to the catalogue
 * by SHA-256, and the file in the repository is exactly the one the manifest records. Rendering and the word-level
 * check run in tools/question-images (PyMuPDF); this test keeps the committed files honest in CI.
 */
const root = join(__dirname, "..", "..");
const manifest = JSON.parse(readFileSync(join(root, "public/catalogue/manifest.json"), "utf8")) as {
  questions: Record<string, { file: string; pdf_sha256: string; pages: number[] }>;
};
const subjects = {
  bhs_language_literature: "Ispitni katalog za BHS jezik.pdf",
  mathematics: "Ispitni katalog za Matematika.pdf",
  german: "Ispitni katalog za Njemački jezik.pdf",
} as const;
const sha256 = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");

describe("question crops (P-15)", () => {
  for (const [subject, pdf] of Object.entries(subjects)) {
    it(`${subject}: every question has a crop of its own catalogue`, () => {
      const records = (JSON.parse(readFileSync(join(root, "tools/canon-ingestion/output", `${subject}.questions.json`), "utf8")) as { records: { id: string }[] }).records;
      const catalogueSha = sha256(join(root, pdf));
      for (const record of records) {
        const entry = manifest.questions[record.id];
        expect(entry, record.id).toBeDefined();
        expect(entry.pdf_sha256).toBe(catalogueSha);
        expect(entry.file).toBe(`/catalogue/${catalogueSha.slice(0, 12)}/${record.id}.png`);
        expect(existsSync(join(root, "public", entry.file)), record.id).toBe(true);
      }
    });
  }

  it("files are exactly the rendered ones", () => {
    for (const [key, entry] of Object.entries(manifest.questions) as [string, { file: string; png_sha256?: string }][]) {
      expect(sha256(join(root, "public", entry.file)), key).toBe(entry.png_sha256);
    }
  });
});
