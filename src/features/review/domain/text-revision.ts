/**
 * Text revisions of trusted questions (AMB-19, PDL-021) are history only since P-15 (PDL-027): students see the
 * printed catalogue page. The review screen still shows earlier revisions, so their shape stays here.
 */

/** The texts of a question that a revision changed. */
export type QuestionText = {
  rawText: string;
  stemText: string | null;
  options: { label: string; text: string }[];
  scoredItems: { itemNumber: number; rawText: string }[];
};

/** Browser forms submitted \r\n; stored and compared texts use \n (migration 014). */
export function normalizeLineBreaks(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}
