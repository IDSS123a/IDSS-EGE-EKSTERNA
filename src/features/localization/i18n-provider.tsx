"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { LOCALE_COOKIE_MAX_AGE_SECONDS, LOCALE_COOKIE_NAME } from "@/constants";
import { DICTIONARIES, type Dictionary, type Locale } from "./config";

type I18nContextValue = {
  locale: Locale;
  dictionary: Dictionary;
  setLocale: (locale: Locale) => void;
};

const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * Provides the active interface language to every client component and switches it
 * instantly, without a page reload (Director decision AMB-11, DECISION_LOG PDL-006).
 * The choice is persisted in a preference cookie so server rendering uses it next time.
 */
export function I18nProvider({ initialLocale, children }: { initialLocale: Locale; children: ReactNode }): ReactNode {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((next: Locale): void => {
    setLocaleState(next);
    // Side effects stay outside the state updater (E-11: updaters must be pure).
    document.cookie = `${LOCALE_COOKIE_NAME}=${next}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
    document.documentElement.lang = next;
    window.IDSSSplash?.setLocale(next);
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({ locale, dictionary: DICTIONARIES[locale], setLocale }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * Access the active locale, its dictionary and the switcher.
 * @throws when used outside <I18nProvider>
 */
export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside <I18nProvider>");
  return context;
}
