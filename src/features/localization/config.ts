import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@/constants";
import bs from "./messages/bs.json";
import de from "./messages/de.json";
import en from "./messages/en.json";

/** An interface language supported by IDSS EGE. */
export type Locale = (typeof SUPPORTED_LOCALES)[number];

/** Shape of every interface dictionary; Bosnian is the reference catalogue. */
export type Dictionary = typeof bs;

/**
 * All interface dictionaries. `satisfies` makes the build fail when a German or English
 * catalogue is missing a key that exists in Bosnian (no silently untranslated UI).
 */
export const DICTIONARIES = { bs, de, en } satisfies Record<Locale, Dictionary>;

/**
 * Narrow an arbitrary string (cookie, header, user input) to a supported locale.
 * @param value candidate locale
 * @returns the locale if supported, otherwise the default (Bosnian)
 */
export function resolveLocale(value: string | null | undefined): Locale {
  return SUPPORTED_LOCALES.find((locale) => locale === value) ?? DEFAULT_LOCALE;
}
