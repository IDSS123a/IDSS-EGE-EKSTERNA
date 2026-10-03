import manifest from "../../../../public/catalogue/manifest.json";

/**
 * Original catalogue crop of a question (P-15, PDL-027): the question exactly as printed, rendered from the stored
 * catalogue by tools/question-images and bound to the catalogue's SHA-256. A crop is returned only when it was rendered
 * from the same catalogue edition as the trusted question version; otherwise null (the screen then says so).
 */
const questions = (manifest as { questions: Record<string, { file: string; pdf_sha256: string }> }).questions;

/** Public path of the question's crop, or null when no crop of this catalogue edition exists. */
export function questionCropPath(recordKey: string, catalogueSha256: string | null | undefined): string | null {
  const entry = questions[recordKey];
  if (!entry || !catalogueSha256 || entry.pdf_sha256 !== catalogueSha256) return null;
  return entry.file;
}
