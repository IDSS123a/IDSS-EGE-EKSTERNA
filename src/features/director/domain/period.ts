import type { AuditFilter, DirectorTab, PeriodChoice } from "../types";

/**
 * Periods of the Director Command Center (PDL-040 K3): the last 7, 30 or 90 days, or the active school year from its
 * first day (only when a school year is active). Framework-free (M-5).
 */

export const DIRECTOR_TABS: DirectorTab[] = ["pregled", "predmeti", "nastavnici", "sadrzaj", "sistem", "dnevnik"];
export const PERIOD_CHOICES: PeriodChoice[] = ["7", "30", "90", "godina"];

export function parseTab(value: string | undefined): DirectorTab {
  return DIRECTOR_TABS.find((tab) => tab === value) ?? "pregled";
}

/** The period asked for, or 30 days; "godina" only when the school year's first day is known. */
export function parsePeriod(value: string | undefined, schoolYearStart: string | null): PeriodChoice {
  const choice = PERIOD_CHOICES.find((entry) => entry === value) ?? "30";
  return choice === "godina" && !schoolYearStart ? "30" : choice;
}

/** The start of the period as an ISO instant (days back from now, or the school year's first day at 00:00 in Sarajevo). */
export function periodStart(choice: PeriodChoice, now: Date, schoolYearStart: string | null): string {
  if (choice === "godina" && schoolYearStart) {
    const start = new Date(`${schoolYearStart}T00:00:00+02:00`);
    return (start > now ? new Date(now.getTime() - 86_400_000) : start).toISOString();
  }
  const days = choice === "godina" ? 30 : Number(choice);
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}

/** Audit log filters from the query string; invalid values are dropped. */
export function parseAuditFilter(params: Record<string, string | undefined>): AuditFilter {
  const day = (value: string | undefined) => (value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) ? value : null);
  const page = Number(params.strana);
  return {
    action: params.akcija && /^[a-z_]+\.[a-z_]+$/.test(params.akcija) ? params.akcija : null,
    person: params.osoba && /^[0-9a-f-]{36}$/i.test(params.osoba) ? params.osoba : null,
    from: day(params.od),
    to: day(params.do),
    page: Number.isInteger(page) && page >= 1 && page <= 10_000 ? page : 1,
  };
}

/** The share in whole percent, or null when it is hidden (K2) or nothing was counted. */
export function percentOf(part: number | null, whole: number | null): number | null {
  return part === null || whole === null || whole <= 0 ? null : Math.round((part / whole) * 100);
}
