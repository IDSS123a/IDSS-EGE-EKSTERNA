/**
 * Minimal structured logger (Commander E-8): one JSON line per event, never passwords,
 * tokens, keys or personal data. Sentry is wired in a later sprint behind this same API.
 */
type LogFields = Record<string, string | number | boolean | null>;

function write(level: "info" | "error", location: string, message: string, fields: LogFields): void {
  const line = JSON.stringify({ timestamp: new Date().toISOString(), level, location, message, ...fields });
  if (level === "error") console.error(line);
  else console.info(line);
}

/** Significant user action (login, logout, account change). */
export function logInfo(location: string, message: string, fields: LogFields = {}): void {
  write("info", location, message, fields);
}

/** Caught exception with context; the stack is logged server-side only (E-5). */
export function logError(location: string, error: unknown, fields: LogFields = {}): void {
  const details: LogFields = error instanceof Error ? { error: error.message, stack: error.stack ?? null } : { error: String(error), stack: null };
  write("error", location, "caught exception", { ...details, ...fields });
}
