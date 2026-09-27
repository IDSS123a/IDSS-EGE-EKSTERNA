import { readPdfText } from "../pdf-lines";
import type { CanonicalDocumentInfo, ExtractionResult } from "../types";
import { extractBhs } from "./bhs";
import { extractGerman } from "./german";
import { extractMathematics } from "./mathematics";
import type { ParserProfile } from "./profiles";

const EXTRACTORS = { mathematics: extractMathematics, bhs_language_literature: extractBhs, german: extractGerman } as const;

/**
 * Run a parser profile over a catalogue file. The caller has already matched the profile to the
 * file's SHA-256 (`profileForSha256`); nothing is extracted from an edition without a profile.
 * @param extractedAt ISO timestamp stamped on every record (one per run)
 * @throws when the bytes are not a readable PDF
 */
export async function extractCatalogue(data: Uint8Array, document: Omit<CanonicalDocumentInfo, "page_count">, profile: ParserProfile, extractedAt: string): Promise<ExtractionResult & { pageCount: number; textLayerEmpty: boolean }> {
  const pdf = await readPdfText(data);
  const info: CanonicalDocumentInfo = { ...document, page_count: pdf.pageCount };
  const result = EXTRACTORS[profile.extractor](pdf, info, profile);
  for (const record of result.records) record.provenance.extracted_at = extractedAt;
  const textLayerEmpty = pdf.pages.every((lines) => lines.length === 0);
  return { ...result, pageCount: pdf.pageCount, textLayerEmpty };
}
