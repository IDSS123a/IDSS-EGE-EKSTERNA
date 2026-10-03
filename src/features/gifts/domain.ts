/** Gift presentation rules (framework-free, M-5). */

/** Splits an engraving message into lines of at most `width` characters, at word boundaries (long words stay whole). */
export function engravingLines(message: string, width = 42): string[] {
  const words = message.trim().split(/\s+/).filter((word) => word.length > 0);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current && `${current} ${word}`.length > width) {
      lines.push(current);
      current = word;
    } else current = current ? `${current} ${word}` : word;
  }
  if (current) lines.push(current);
  return lines;
}

/** Unboxing timeline in seconds (PDL-039): wobble, lid off, burst, assembly, light sweep. */
export const UNBOXING = { wobbleEnd: 1.4, lidEnd: 2.4, burstEnd: 4.2, assembleEnd: 6.4, sweepEnd: 8.4 } as const;

/** Progress 0..1 of a phase at time t, eased (smoothstep). */
export function phase(t: number, start: number, end: number): number {
  const x = Math.min(1, Math.max(0, (t - start) / (end - start)));
  return x * x * (3 - 2 * x);
}
