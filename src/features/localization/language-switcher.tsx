"use client";

import type { ReactNode } from "react";
import { SUPPORTED_LOCALES } from "@/constants";
import { useI18n } from "./i18n-provider";

/**
 * Segmented language control (bs / de / en). Switching is instant for every role.
 * Rendered as a radio group so keyboard and screen-reader users get the standard pattern.
 */
export function LanguageSwitcher(): ReactNode {
  const { locale, dictionary, setLocale } = useI18n();

  return (
    <fieldset className="language-switcher">
      <legend className="sr-only">{dictionary.language.label}</legend>
      {SUPPORTED_LOCALES.map((option) => (
        <label key={option} className="language-switcher__option" data-active={option === locale}>
          <input
            type="radio"
            name="interface-language"
            value={option}
            checked={option === locale}
            onChange={() => setLocale(option)}
            className="sr-only"
          />
          <span aria-hidden="true">{option.toUpperCase()}</span>
          <span className="sr-only">{dictionary.language.names[option]}</span>
        </label>
      ))}
    </fieldset>
  );
}
