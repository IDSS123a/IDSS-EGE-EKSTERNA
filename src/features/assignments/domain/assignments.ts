/**
 * Assignment input rules (framework-free, M-5). The database repeats every check (migration 029).
 */

/** Catalogue keys typed by the teacher: separated by commas, semicolons, spaces or new lines; upper case; once each. */
export function parseKeys(text: string): string[] {
  const keys = text.split(/[\s,;]+/).map((key) => key.trim().toUpperCase()).filter((key) => key.length > 0);
  return [...new Set(keys)];
}

/** The Europe/Sarajevo offset in minutes at a moment (positive east of UTC). */
function sarajevoOffsetMinutes(utcMillis: number): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Sarajevo", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .formatToParts(new Date(utcMillis));
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? "0");
  const wall = Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"), value("second"));
  return Math.round((wall - utcMillis) / 60_000);
}

/**
 * A `datetime-local` value ("2026-10-10T20:00") read as Europe/Sarajevo time, as an ISO instant; null when invalid.
 * Two passes settle the offset across a daylight saving change.
 */
export function sarajevoLocalToIso(local: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const asUtc = Date.UTC(year, month - 1, day, hour, minute);
  const check = new Date(asUtc);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day || hour > 23 || minute > 59) return null;
  let instant = asUtc - sarajevoOffsetMinutes(asUtc) * 60_000;
  instant = asUtc - sarajevoOffsetMinutes(instant) * 60_000;
  return new Date(instant).toISOString();
}

/** Share of answered questions in whole percent (0 when the assignment has no question). */
export function answeredPercent(answered: number, total: number): number {
  return total > 0 ? Math.round((answered / total) * 100) : 0;
}
