import { describe, expect, it } from "vitest";
import calibration from "../../config/splash-calibration.json";
import { DEFAULT_SPLASH_SHARES, thresholdFor, thresholdsFor, validShares } from "@/features/splash/palette";
import { SplashPaletteSchema } from "@/lib/validation/schemas";

describe("splash palette (PDL-020)", () => {
  it("default shares are valid and map to the thresholds splash.js ships with", () => {
    expect(validShares(DEFAULT_SPLASH_SHARES)).toBe(true);
    expect(thresholdsFor(DEFAULT_SPLASH_SHARES)).toEqual({ redThreshold: 0.6993, skyThreshold: 0.4433, yellowFrom: 0.1833 });
  });

  it("inverts a measured curve by linear interpolation and clamps outside it", () => {
    const curve = [[0.5, 0.6], [0.6, 0.2], [0.7, 0]];
    expect(thresholdFor(curve, 0.4)).toBeCloseTo(0.55, 6);
    expect(thresholdFor(curve, 0.9)).toBe(0.5);
    expect(thresholdFor(curve, 0)).toBe(0.6 + 0.1);
  });

  it("skips flat stretches of the yellow curve", () => {
    const yellow = calibration.yellowFrom;
    const t = thresholdFor(yellow, 0.3);
    expect(t).toBeGreaterThan(0.7);
    expect(t).toBeLessThan(0.85);
  });

  it("more of a colour means a lower threshold (monotonic)", () => {
    const less = thresholdsFor({ red: 1, yellow: 30, blue: 39, sky: 30 });
    const more = thresholdsFor({ red: 5, yellow: 40, blue: 20, sky: 35 });
    expect(more.redThreshold).toBeLessThan(less.redThreshold);
    expect(more.skyThreshold).toBeLessThan(less.skyThreshold);
    expect(more.yellowFrom).toBeLessThan(less.yellowFrom);
  });

  it("a colour at 0 % is switched off", () => {
    const none = thresholdsFor({ red: 0, yellow: 50, blue: 50, sky: 0 });
    expect(none.redThreshold).toBe(5);
    expect(none.skyThreshold).toBe(5);
  });

  it("the form accepts four shares that add up to 100 and nothing else", () => {
    expect(SplashPaletteSchema.safeParse({ red: "1.5", yellow: "40", blue: "28.5", sky: "30" }).success).toBe(true);
    expect(SplashPaletteSchema.safeParse({ red: 2, yellow: 36, blue: 29, sky: 30 }).success).toBe(false);
    expect(SplashPaletteSchema.safeParse({ red: -1, yellow: 37, blue: 34, sky: 30 }).success).toBe(false);
    expect(validShares({ red: 2, yellow: 36, blue: 29, sky: 33.2 })).toBe(false);
  });
});
