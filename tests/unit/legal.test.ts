import { describe, expect, it } from "vitest";
import bs from "../../content/legal/bs.json";
import de from "../../content/legal/de.json";
import en from "../../content/legal/en.json";

/**
 * Legal documents v2.0 (AMB-20): the three languages carry the same structure, and the privacy
 * policy names the school's data protection officer, the law and the supervisory authority.
 */
const DOCUMENTS = ["terms", "privacy", "subscription", "cookies"] as const;
type Texts = typeof bs;

function shape(texts: Texts): number[][][] {
  return DOCUMENTS.map((key) => texts[key].sections.map((section) => ["items" in section && section.items ? section.items.length : 0, section.paragraphs.length]));
}

describe("legal documents", () => {
  it("have the same sections, paragraphs and list items in every language", () => {
    expect(shape(de)).toEqual(shape(bs));
    expect(shape(en)).toEqual(shape(bs));
  });

  for (const [locale, texts] of Object.entries({ bs, de, en })) {
    it(`name the data protection officer, the law and the agency: ${locale}`, () => {
      const privacy = JSON.stringify(texts.privacy);
      expect(privacy).toContain("gdpr@idss.ba");
      expect(privacy).toContain("+387 33 267 965");
      expect(privacy).toContain("12/25");
      expect(privacy).toContain("2016/679");
      expect(privacy).toContain("azlpinfo@azlp.ba");
      expect(JSON.stringify(texts.cookies)).toContain("gdpr@idss.ba");
    });
  }
});
