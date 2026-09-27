import { flowWeightsFor, type FlowWeights } from "./flow";

/**
 * Splash palette (PDL-019, PDL-020, PDL-022): the Director sets the share of each IDSS colour in the splash
 * field in percent; the FLOW field (./flow.ts) turns shares into colour weights by measuring the rendered
 * field. Framework-free and deterministic.
 */

export type SplashShares = { red: number; yellow: number; blue: number; sky: number };

/** Shares in percent of the field; they must add up to 100. */
export const DEFAULT_SPLASH_SHARES: SplashShares = { red: 2, yellow: 36, blue: 29, sky: 33 };

/** True when all four shares are finite, between 0 and 100, and add up to 100 (to 0.1). */
export function validShares(shares: SplashShares): boolean {
  const values = [shares.red, shares.yellow, shares.blue, shares.sky];
  return values.every((value) => Number.isFinite(value) && value >= 0 && value <= 100) && Math.abs(values.reduce((a, b) => a + b, 0) - 100) < 0.1;
}

const fitted = new Map<string, FlowWeights>();

/** Colour weights (stop order red, sky, blue, yellow) that give the wanted shares; memoised per palette. */
export function splashWeightsFor(shares: SplashShares): FlowWeights {
  const key = [shares.red, shares.sky, shares.blue, shares.yellow].join("/");
  const known = fitted.get(key);
  if (known) return known;
  const weights = flowWeightsFor(shares);
  fitted.set(key, weights);
  return weights;
}
