import { describe, expect, it } from "vitest";
import { findTextStyleViolations, replaceForbiddenCharacters } from "@/lib/text-style";
import bs from "@/features/localization/messages/bs.json";
import de from "@/features/localization/messages/de.json";
import en from "@/features/localization/messages/en.json";
import splash from "../../public/splash/messages.json";

function texts(value: unknown, key = ""): string[] {
  if (key.startsWith("_")) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap((item) => texts(item));
  if (value && typeof value === "object") return Object.entries(value).flatMap(([k, v]) => texts(v, k));
  return [];
}

describe("app text style rule (P-13)", () => {
  it("detects AI characters, emoji and AI phrasing", () => {
    const kinds = findTextStyleViolations("Odlično pitanje! Rješenje je 5 — provjeri… \u{1F680}").map((v) => v.kind);
    expect(kinds).toEqual(["phrase", "character", "character", "emoji"]);
    expect(findTextStyleViolations("Rješenje je 5, provjeri još jednom.")).toEqual([]);
  });

  it("replaces forbidden characters with plain ones", () => {
    const cleaned = replaceForbiddenCharacters("Rezultat — tačno… „dobro“ → dalje \u{1F389}");
    expect(cleaned).toBe('Rezultat, tačno... "dobro" -> dalje ');
    expect(findTextStyleViolations(cleaned)).toEqual([]);
  });

  it("every interface and splash text follows the rule", () => {
    for (const text of texts([bs, de, en, splash])) {
      expect(findTextStyleViolations(text), text).toEqual([]);
    }
  });
});
