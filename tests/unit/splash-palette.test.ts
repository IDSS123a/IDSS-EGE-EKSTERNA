import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FLOW_STOPS, flowColour, measureFlowShares } from "@/features/splash/flow";
import { DEFAULT_SPLASH_SHARES, splashWeightsFor, validShares } from "@/features/splash/palette";
import { SplashPaletteSchema } from "@/lib/validation/schemas";

const SPLASH_JS = readFileSync(join(__dirname, "../../public/splash/splash.js"), "utf8");
const percent = (values: number[]) => values.map((value) => value * 100);

describe("splash palette (PDL-020, PDL-022)", () => {
  it("default shares are valid and give the weights splash.js ships with", () => {
    expect(validShares(DEFAULT_SPLASH_SHARES)).toBe(true);
    const weights = splashWeightsFor(DEFAULT_SPLASH_SHARES);
    expect(SPLASH_JS).toContain(`weights: [${weights.join(", ")}]`);
    expect(SPLASH_JS).toContain(`stops: [${FLOW_STOPS.map((stop) => `"${stop}"`).join(", ")}]`);
  });

  it("the fitted weights give each colour its share (within half a point)", () => {
    for (const shares of [DEFAULT_SPLASH_SHARES, { red: 25, yellow: 25, blue: 25, sky: 25 }, { red: 5, yellow: 35, blue: 40, sky: 20 }]) {
      const measured = percent(measureFlowShares(splashWeightsFor(shares)));
      const wanted = [shares.red, shares.sky, shares.blue, shares.yellow];
      measured.forEach((value, index) => expect(Math.abs(value - wanted[index])).toBeLessThan(0.5));
    }
  });

  it("a colour at 0 % does not appear", () => {
    const weights = splashWeightsFor({ red: 0, yellow: 50, blue: 50, sky: 0 });
    expect(weights[0]).toBe(0);
    expect(weights[1]).toBe(0);
    expect(percent(measureFlowShares(weights)).slice(0, 2)).toEqual([0, 0]);
  });

  it("mixes neighbouring colours smoothly (the field is a blend, not hard patches)", () => {
    const colour = flowColour(0.5, 0.5, 116.03, [1, 1, 1, 1]);
    expect(colour.every((channel) => channel >= 0 && channel <= 255)).toBe(true);
  });

  it("the form accepts four shares that add up to 100 and nothing else", () => {
    expect(SplashPaletteSchema.safeParse({ red: "1.5", yellow: "40", blue: "28.5", sky: "30" }).success).toBe(true);
    expect(SplashPaletteSchema.safeParse({ red: 2, yellow: 36, blue: 29, sky: 30 }).success).toBe(false);
    expect(SplashPaletteSchema.safeParse({ red: -1, yellow: 37, blue: 34, sky: 30 }).success).toBe(false);
    expect(validShares({ red: 2, yellow: 36, blue: 29, sky: 33.2 })).toBe(false);
  });
});
