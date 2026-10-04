import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { allGuideImages, buildGuide, GUIDE_CHOICES } from "@/features/guide/content";
// The screenshot list of tools/guide-screens (plain JavaScript module).
import shots from "../../tools/guide-screens/shots.mjs";

const files = readdirSync(join(process.cwd(), "public", "guide")).filter((file) => file.endsWith(".webp")).map((file) => file.replace(/\.webp$/, "")).sort();

describe("user guide (PDL-031)", () => {
  it("has a screenshot for every step and no unused screenshot", () => {
    expect(files).toEqual(allGuideImages());
  });

  it("can take every screenshot again: each image has exactly one capture entry", () => {
    const images = (shots as { image: string }[]).map((shot) => shot.image).sort();
    expect(images).toEqual(allGuideImages());
  });

  it("gives every participant a guide with numbered steps", () => {
    for (const choice of GUIDE_CHOICES) {
      const guide = buildGuide(choice.reader);
      expect(guide.sections.length).toBeGreaterThan(2);
      expect(guide.sections.every((section) => section.steps.length > 0)).toBe(true);
    }
  });

  it("personalises the guide: the own username and every taught subject", () => {
    const guide = buildGuide({ kind: "teacher", name: "Haris Hamzić", username: "haris.hamzic@idss.ba", subjects: ["mathematics", "german"] });
    expect(guide.intro).toContain("Haris Hamzić");
    expect(guide.sections[0].steps[1].text).toContain("haris.hamzic@idss.ba");
    expect(guide.sections.map((section) => section.id)).toEqual(expect.arrayContaining(["plan-mat", "plan-deu"]));
    expect(guide.title).toContain("Matematika");
  });

  it("tells the pedagogue and the psychologist their own default note visibility", () => {
    const text = (kind: "pedagogue" | "psychologist") => buildGuide({ kind, name: "", username: null, subjects: [] }).sections.find((section) => section.id === "biljeske")?.steps[0].text ?? "";
    expect(text("pedagogue")).toContain("po zadanom vidi i psiholog");
    expect(text("psychologist")).toContain("po zadanom **Samo ja**");
  });
});
