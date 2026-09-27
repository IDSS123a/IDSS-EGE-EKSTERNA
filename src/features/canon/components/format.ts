/**
 * Display formatting for the registry. Dates are composed from numeric parts, because
 * browsers ship different locale data for Bosnian (one showed "2026 M09 27"); a fixed time
 * zone keeps the server-rendered and the hydrated text identical and matches the school.
 */
const TIME_ZONE = "Europe/Sarajevo";
const BYTES_PER_MEGABYTE = 1024 * 1024;
const PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Date and time of an ISO timestamp: 27.09.2026. 14:05 (bs), 27.09.2026, 14:05 (de), 27/09/2026 14:05 (en). */
export function formatDateTime(iso: string, locale: string): string {
  const part = (type: Intl.DateTimeFormatPartTypes) => PARTS.formatToParts(new Date(iso)).find((entry) => entry.type === type)?.value ?? "";
  const [day, month, year, time] = [part("day"), part("month"), part("year"), `${part("hour")}:${part("minute")}`];
  if (locale === "en") return `${day}/${month}/${year} ${time}`;
  if (locale === "de") return `${day}.${month}.${year}, ${time}`;
  return `${day}.${month}.${year}. ${time}`;
}

/** File size in MB with one decimal, in the interface language. */
export function formatBytes(bytes: number, locale: string): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(bytes / BYTES_PER_MEGABYTE)} MB`;
}
