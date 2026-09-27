/**
 * The splash FLOW field (PDL-007, PDL-022): a port of the reference "Untitled blend" FLOW recipe the
 * Director approved. Four colour points drift over the field; every pixel mixes the four colours by
 * inverse distance, after a soft warp and swirl. A colour's weight widens its region; the Director's
 * shares in percent are turned into weights by measuring the rendered field and adjusting the weights
 * until each colour covers its share. `public/splash/splash.js` runs the same formula as a WebGL
 * shader. Framework-free and deterministic.
 */

/** Reference stops in their original order (the point of colour i follows its own path). */
export const FLOW_STOPS = ["#E8262C", "#08ABE6", "#035EA1", "#FFCB29"] as const;
/** Share keys in stop order. */
export const FLOW_KEYS = ["red", "sky", "blue", "yellow"] as const;

/** Reference recipe dials. */
export const FLOW_RECIPE = { scale: 56, distortion: 18, swirl: 13, speed: 30, startTime: 116.03 } as const;
/** Clock of the reference player: time advances by speed / 100 * 1.2 per second. */
export const FLOW_TIME_PER_SECOND = (FLOW_RECIPE.speed / 100) * 1.2;

/** Moments measured when fitting weights: the first seconds of the splash, where it is seen. */
const SAMPLE_SECONDS = [0, 0.75, 1.5, 2.25, 3, 3.75, 4.5, 5.25, 6];
const SAMPLE_COLUMNS = 96;
const SAMPLE_ROWS = 64;
const FIT_ROUNDS = 40;
const FIT_TOLERANCE = 0.002;

export type FlowWeights = [number, number, number, number];
export type FlowShares = { red: number; sky: number; blue: number; yellow: number };

const RGB = FLOW_STOPS.map((hex) => {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
});

function smooth(value: number): number {
  const t = Math.min(1, Math.max(0, value));
  return t * t * (3 - 2 * t);
}

/** Position of colour point i at time t (reference path). */
export function flowPoint(index: number, time: number): [number, number] {
  const offset = index * 0.37;
  const a = 0.6 + (index / 3 - Math.floor(index / 3)) * 0.9;
  const b = 0.8 + ((index + 1) / 4 - Math.floor((index + 1) / 4));
  return [0.5 + 0.5 * Math.sin(time * a + offset), 0.5 + 0.5 * Math.cos(time * b + offset * 1.5)];
}

/** Colour (0 to 255 per channel) of the field at (x, y) in [0, 1], y from the top. */
export function flowColour(x: number, y: number, time: number, weights: FlowWeights): [number, number, number] {
  const m = 0.4 + (FLOW_RECIPE.scale / 100) * 1.2;
  const u = FLOW_RECIPE.distortion / 100;
  const p = FLOW_RECIPE.swirl / 100;
  let px = (x - 0.5) / m + 0.5;
  let py = (y - 0.5) / m + 0.5;
  const n = smooth(Math.hypot(px - 0.5, py - 0.5));
  const falloff = 1 - n;
  for (let step = 1; step <= 2; step += 1) {
    px += ((u * falloff) / step) * Math.sin(time + step * 0.4 * smooth(py)) * Math.cos(0.2 * time + step * 2.4 * smooth(py));
    py += ((u * falloff) / step) * Math.cos(time + step * 2 * smooth(px));
  }
  const angle = -3 * p * n;
  const cx = px - 0.5;
  const cy = py - 0.5;
  px = Math.cos(angle) * cx - Math.sin(angle) * cy + 0.5;
  py = Math.sin(angle) * cx + Math.cos(angle) * cy + 0.5;
  let r = 0;
  let g = 0;
  let b = 0;
  let total = 0;
  for (let index = 0; index < 4; index += 1) {
    const [qx, qy] = flowPoint(index, time);
    const d2 = (px - qx) ** 2 + (py - qy) ** 2;
    const influence = weights[index] / (d2 * d2 + 1e-4);
    r += RGB[index][0] * influence;
    g += RGB[index][1] * influence;
    b += RGB[index][2] * influence;
    total += influence;
  }
  const scale = 1 / Math.max(1e-4, total);
  return [r * scale, g * scale, b * scale];
}

/** Share of the field (0 to 1) nearest to each stop colour, over the first seconds of the splash. */
export function measureFlowShares(weights: FlowWeights): FlowWeights {
  const counts: FlowWeights = [0, 0, 0, 0];
  let pixels = 0;
  for (const second of SAMPLE_SECONDS) {
    const time = FLOW_RECIPE.startTime + second * FLOW_TIME_PER_SECOND;
    for (let row = 0; row < SAMPLE_ROWS; row += 1) {
      for (let column = 0; column < SAMPLE_COLUMNS; column += 1) {
        const colour = flowColour((column + 0.5) / SAMPLE_COLUMNS, (row + 0.5) / SAMPLE_ROWS, time, weights);
        let nearest = 0;
        let best = Infinity;
        for (let index = 0; index < 4; index += 1) {
          const distance = (colour[0] - RGB[index][0]) ** 2 + (colour[1] - RGB[index][1]) ** 2 + (colour[2] - RGB[index][2]) ** 2;
          if (distance < best) {
            best = distance;
            nearest = index;
          }
        }
        counts[nearest] += 1;
        pixels += 1;
      }
    }
  }
  return counts.map((count) => count / pixels) as FlowWeights;
}

/**
 * Weights that make each colour cover its share (percent, adding up to 100). A colour with share 0
 * gets weight 0 and does not appear. Weights are adjusted multiplicatively from the reference start
 * (share times four, as in the reference tool) until every share is met within FIT_TOLERANCE.
 */
export function flowWeightsFor(shares: FlowShares): FlowWeights {
  const targets = FLOW_KEYS.map((key) => shares[key] / 100);
  let weights = targets.map((target) => target * 4) as FlowWeights;
  for (let round = 0; round < FIT_ROUNDS; round += 1) {
    const measured = measureFlowShares(weights);
    if (targets.every((target, index) => Math.abs(measured[index] - target) <= FIT_TOLERANCE)) break;
    weights = weights.map((weight, index) => {
      if (targets[index] === 0) return 0;
      const ratio = measured[index] > 0 ? targets[index] / measured[index] : 2;
      return weight * Math.min(2, Math.max(0.5, ratio ** 0.8));
    }) as FlowWeights;
    const sum = weights.reduce((a, b) => a + b, 0);
    weights = weights.map((weight) => (weight * 4) / sum) as FlowWeights;
  }
  return weights.map((weight) => Math.round(weight * 10000) / 10000) as FlowWeights;
}
