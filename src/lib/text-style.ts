import rules from "../../config/app-text-style.json";

/**
 * App text style rule (CONSTITUTION P-13, Director 2026-09-27): recognisable AI characters and
 * AI phrasing are forbidden in every text the app shows or the AI generates (UI, simulations,
 * chatbot answers, feedback). The rule list is data in config/app-text-style.json.
 * Canonical source text (official questions and answers) is exempt: it is never checked or changed.
 */

export interface TextStyleViolation {
  kind: "character" | "emoji" | "phrase";
  match: string;
  index: number;
  name: string;
}

const EMOJI_PATTERN = /\p{Extended_Pictographic}/gu;

/** Every rule violation in `text`, in order of appearance. */
export function findTextStyleViolations(text: string): TextStyleViolation[] {
  const violations: TextStyleViolation[] = [];
  for (const rule of rules.forbiddenCharacters) {
    for (let index = text.indexOf(rule.char); index !== -1; index = text.indexOf(rule.char, index + 1)) {
      violations.push({ kind: "character", match: rule.char, index, name: rule.name });
    }
  }
  if (rules.forbidEmoji) {
    for (const match of text.matchAll(EMOJI_PATTERN)) {
      violations.push({ kind: "emoji", match: match[0], index: match.index, name: "emoji" });
    }
  }
  const lower = text.toLowerCase();
  for (const phrase of rules.forbiddenPhrases) {
    const needle = phrase.toLowerCase();
    for (let index = lower.indexOf(needle); index !== -1; index = lower.indexOf(needle, index + 1)) {
      violations.push({ kind: "phrase", match: phrase, index, name: "AI phrasing" });
    }
  }
  return violations.sort((a, b) => a.index - b.index);
}

/**
 * Replaces forbidden characters with plain equivalents and removes emoji. Phrases are not
 * rewritten (that would change meaning): generated text that still contains a forbidden
 * phrase must be regenerated, never shown.
 */
export function replaceForbiddenCharacters(text: string): string {
  let result = text;
  for (const rule of rules.forbiddenCharacters) {
    const spaced = rule.replacement.startsWith(",") ? new RegExp(`\\s*${rule.char}\\s*`, "g") : new RegExp(rule.char, "g");
    result = result.replace(spaced, rule.replacement);
  }
  return rules.forbidEmoji ? result.replace(EMOJI_PATTERN, "") : result;
}
