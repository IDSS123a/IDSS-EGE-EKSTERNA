import { z } from "zod";
import proposals from "../../../../config/text-revision-proposals.json";

/**
 * Reviewed text revisions of trusted questions (AMB-19, PDL-021). The trusted version keeps the text
 * as extracted from the printed catalogue; a revision replaces texts only, and the newest revision is
 * the text shown. Proposals in config/text-revision-proposals.json are prepared from the source page
 * and applied only when a reviewer confirms them.
 */

/** The texts of a question that a revision may change. */
export type QuestionText = {
  rawText: string;
  stemText: string | null;
  options: { label: string; text: string }[];
  scoredItems: { itemNumber: number; rawText: string }[];
};

const ReplacementSchema = z.object({ find: z.string().min(1), replace: z.string() });
const ProposalSchema = z.object({
  record_key: z.string().regex(/^[A-Z]+-[0-9A-Za-z.]+$/),
  page: z.number().int().positive(),
  footnotes: z.array(z.number().int().positive()).min(1),
  replacements: z.array(ReplacementSchema).min(1),
});
const ProposalFileSchema = z.object({ ambiguity: z.string(), reason: z.string().min(1), proposals: z.array(ProposalSchema) });

export type TextProposal = z.infer<typeof ProposalSchema>;
const proposalFile = ProposalFileSchema.parse(proposals);

/** Every prepared proposal (tests and the review screen). */
export function allTextProposals(): TextProposal[] {
  return proposalFile.proposals;
}

/** The reason stored with a confirmed proposal. */
export const PROPOSAL_REASON = proposalFile.reason;

function patternOf(find: string): RegExp {
  // A run of spaces in the proposal matches any run of spaces in the text (extractors differ in spacing).
  const escaped = find.split(/ +/).map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(escaped.join(" +"), "g");
}

function replaceAll(text: string, replacements: TextProposal["replacements"], hits: number[]): string {
  return replacements.reduce((current, replacement, index) => {
    const pattern = patternOf(replacement.find);
    const matches = current.match(pattern)?.length ?? 0;
    hits[index] += matches;
    return matches > 0 ? current.replace(pattern, () => replacement.replace) : current;
  }, text);
}

/**
 * Applies a proposal to every text field. Returns null when any replacement matches nowhere: the
 * stored text is not the one the proposal was prepared from, and a reviewer edits by hand instead.
 */
export function applyProposal(text: QuestionText, proposal: TextProposal): QuestionText | null {
  const hits = proposal.replacements.map(() => 0);
  const revised: QuestionText = {
    rawText: replaceAll(text.rawText, proposal.replacements, hits),
    stemText: text.stemText === null ? null : replaceAll(text.stemText, proposal.replacements, hits),
    options: text.options.map((option) => ({ label: option.label, text: replaceAll(option.text, proposal.replacements, hits) })),
    scoredItems: text.scoredItems.map((item) => ({ itemNumber: item.itemNumber, rawText: replaceAll(item.rawText, proposal.replacements, hits) })),
  };
  return hits.every((count) => count > 0) ? revised : null;
}

/** The proposal for a record key, applied to the current text, if one exists and still matches. */
export function proposedText(recordKey: string, current: QuestionText): QuestionText | null {
  const proposal = proposalFile.proposals.find((candidate) => candidate.record_key === recordKey);
  return proposal ? applyProposal(current, proposal) : null;
}

/** True when two texts are the same (a revision that changes nothing is not offered). */
export function sameText(a: QuestionText, b: QuestionText): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
