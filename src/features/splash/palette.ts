import calibration from "../../../config/splash-calibration.json";

/**
 * Splash palette (PDL-019, PDL-020): the Director sets the share of each IDSS colour in the splash field in
 * percent; this module turns shares into the shader thresholds of `public/splash/splash.js`, using curves
 * measured on rendered frames (`config/splash-calibration.json`). Framework-free and deterministic.
 *
 * Layer model of the shader: red is drawn over everything, sky over the blue/yellow field, and the field
 * splits into yellow and blue. With independent noise fields the visible shares are
 * red = R(tr), sky = S(ts)(1 - red), yellow = Y(ty)(1 - S)(1 - red), blue = the rest.
 */

export type SplashShares = { red: number; yellow: number; blue: number; sky: number };
export type SplashThresholds = { redThreshold: number; skyThreshold: number; yellowFrom: number };

/** Shares in percent of the field; they must add up to 100. */
export const DEFAULT_SPLASH_SHARES: SplashShares = { red: 2, yellow: 36, blue: 29, sky: 33 };

type Curve = readonly (readonly number[])[];

/**
 * Threshold for a wanted share on a measured, non-increasing curve (share falls as the threshold rises).
 * Flat stretches are skipped; wanted shares outside the measured range are clamped to its ends.
 */
export function thresholdFor(curve: Curve, share: number): number {
  const points = curve.filter((point, index) => index === 0 || point[1] !== curve[index - 1][1]);
  if (share >= points[0][1]) return points[0][0];
  const last = points[points.length - 1];
  if (share <= last[1]) return last[0];
  for (let index = 1; index < points.length; index += 1) {
    const [t0, s0] = points[index - 1];
    const [t1, s1] = points[index];
    if (share <= s0 && share >= s1) return s0 === s1 ? t0 : t0 + ((s0 - share) / (s0 - s1)) * (t1 - t0);
  }
  return last[0];
}

/** True when all four shares are finite, between 0 and 100, and add up to 100 (to 0.1). */
export function validShares(shares: SplashShares): boolean {
  const values = [shares.red, shares.yellow, shares.blue, shares.sky];
  return values.every((value) => Number.isFinite(value) && value >= 0 && value <= 100) && Math.abs(values.reduce((a, b) => a + b, 0) - 100) < 0.1;
}

/** Shader thresholds that give the wanted shares (percent of the field). */
export function thresholdsFor(shares: SplashShares): SplashThresholds {
  const red = shares.red / 100;
  const sky = red < 1 ? Math.min(1, shares.sky / 100 / (1 - red)) : 0;
  const yellowBase = (1 - red) * (1 - sky);
  const yellow = yellowBase > 0 ? Math.min(1, shares.yellow / 100 / yellowBase) : 0;
  const round = (value: number) => Math.round(value * 10000) / 10000;
  return {
    redThreshold: round(shares.red <= 0 ? 5 : thresholdFor(calibration.redThreshold, red)),
    skyThreshold: round(shares.sky <= 0 ? 5 : thresholdFor(calibration.skyThreshold, sky)),
    yellowFrom: round(thresholdFor(calibration.yellowFrom, yellow)),
  };
}
