import "server-only";
import { createHash } from "node:crypto";
import { PWNED_PASSWORDS_TIMEOUT_MS, PWNED_PASSWORDS_URL } from "@/constants";
import { logError } from "@/lib/logger";

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/**
 * Leaked-password check (PDL-030) with the Pwned Passwords range API (k-anonymity): only the first five characters of
 * the password's SHA-1 hash leave the server; the API answers every hash suffix it knows for that prefix, and the match
 * is made here. Supabase offers the same check only on Pro plans.
 * @returns true when the password appears in known breaches, false when it does not, null when the service did not
 *   answer (the caller accepts the password; availability over a check that cannot run)
 */
export async function isPasswordPwned(password: string, fetchImpl: FetchLike = fetch, timeoutMs: number = PWNED_PASSWORDS_TIMEOUT_MS): Promise<boolean | null> {
  const hash = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  try {
    const response = await fetchImpl(`${PWNED_PASSWORDS_URL}${prefix}`, {
      headers: { "Add-Padding": "true", "User-Agent": "IDSS-External-Graduate-Examination" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error(`Pwned Passwords answered ${response.status}`);
    const body = await response.text();
    return body.split("\n").some((line) => {
      const [candidate, count] = line.trim().split(":");
      return candidate === suffix && Number(count) > 0;
    });
  } catch (error) {
    logError("security/pwned-passwords.isPasswordPwned", error);
    return null;
  }
}
