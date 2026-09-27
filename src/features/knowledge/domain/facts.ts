import { z } from "zod";
import facts from "../../../../config/canonical-facts.json";
import type { PdfText } from "@/features/ingestion/pdf-lines";

/**
 * Canonical facts with provenance (PDL-015): exam subjects and exam rules per catalogue edition,
 * bound by SHA-256, each value backed by verbatim quotes with their PDF page. The file is data;
 * nothing here interprets exam rules. Quotes are verified against the actual PDF text layer
 * before anything is stored (P-4: no fact without its source).
 */

const RULE_CODE = /^[a-z_]+\.[a-z_]+$/;
const EvidenceSchema = z.object({ page: z.number().int().positive(), quote: z.string().min(3) });
const SubjectSchema = z.object({
  code: z.enum(["mathematics", "bhs_language_literature", "german"]),
  official_name: z.string().min(3),
  legal_basis: z.string().min(3),
  evidence: z.array(EvidenceSchema).min(1),
});
const RuleSchema = z.object({
  code: z.string().regex(RULE_CODE),
  value: z.record(z.string(), z.unknown()),
  evidence: z.array(EvidenceSchema).min(1),
});
const EditionSchema = z.object({
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  file: z.string().min(1),
  subject: SubjectSchema,
  rules: z.array(RuleSchema).min(1),
});
const FactsFileSchema = z.object({ version: z.number().int().positive(), editions: z.array(EditionSchema) });

export type FactEvidence = z.infer<typeof EvidenceSchema>;
export type CanonicalRuleFact = z.infer<typeof RuleSchema>;
export type EditionFacts = z.infer<typeof EditionSchema>;

const FILE = FactsFileSchema.parse(facts);

/** Version of the facts file (stored with every load, like the parser profile version). */
export const FACTS_VERSION = FILE.version;

/** The reviewed facts for an exact catalogue edition, or null (never guessed for another edition). */
export function factsForSha256(sha256: string): EditionFacts | null {
  return FILE.editions.find((edition) => edition.sha256 === sha256) ?? null;
}

/** All editions (tests and reports). */
export function allEditionFacts(): readonly EditionFacts[] {
  return FILE.editions;
}

/** Whitespace-insensitive form used to compare a quote with a page (line breaks become spaces). */
export function normalizeForQuote(text: string): string {
  return text.replace(/\s+/gu, " ").trim();
}

/** Text of one 1-based page, lines joined in reading order. */
export function pageText(pdf: PdfText, page: number): string {
  return normalizeForQuote((pdf.pages[page - 1] ?? []).map((line) => line.text).join(" "));
}

/** Every piece of evidence of an edition (subject first, then rules in file order). */
export function editionEvidence(edition: EditionFacts): { owner: string; evidence: FactEvidence }[] {
  return [
    ...edition.subject.evidence.map((evidence) => ({ owner: `subject.${edition.subject.code}`, evidence })),
    ...edition.rules.flatMap((rule) => rule.evidence.map((evidence) => ({ owner: rule.code, evidence }))),
  ];
}

/** Evidence whose quote is not found verbatim on its page; empty when the edition is fully backed. */
export function missingQuotes(edition: EditionFacts, pdf: PdfText): { owner: string; page: number; quote: string }[] {
  return editionEvidence(edition)
    .filter(({ evidence }) => !pageText(pdf, evidence.page).includes(normalizeForQuote(evidence.quote)))
    .map(({ owner, evidence }) => ({ owner, page: evidence.page, quote: evidence.quote }));
}
