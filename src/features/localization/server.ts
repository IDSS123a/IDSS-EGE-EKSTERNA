import "server-only";
import { cookies } from "next/headers";
import { LOCALE_COOKIE_NAME } from "@/constants";
import { DICTIONARIES, resolveLocale, type Dictionary, type Locale } from "./config";

/**
 * Read the user's interface language from the preference cookie (server side), so the
 * first HTML response is already in the chosen language (no flash of the wrong language).
 * @returns the resolved locale (Bosnian when unset or unsupported)
 */
export async function getRequestLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  return resolveLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
}

/**
 * Dictionary for a locale (server components, metadata).
 * @param locale supported locale
 * @returns the interface dictionary
 */
export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}
