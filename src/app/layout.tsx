import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import { headers } from "next/headers";
import { Inter, Sora } from "next/font/google";
import { BRAND_LOGO_PATH, SPLASH_SCRIPT_PATH, SPLASH_STYLESHEET_PATH } from "@/constants";
import { I18nProvider } from "@/features/localization/i18n-provider";
import { getDictionary, getRequestLocale } from "@/features/localization/server";
import { SplashScreen } from "@/features/splash/components/splash-screen";
import { SplashReadySignal } from "@/features/splash/components/splash-ready-signal";
import { pickFirstSplashMessageIndex } from "@/features/splash/domain";
import splashMessages from "../../public/splash/messages.json";
import "./globals.css";

const displayFont = Sora({ variable: "--font-display", subsets: ["latin", "latin-ext"], display: "swap" });
const bodyFont = Inter({ variable: "--font-body", subsets: ["latin", "latin-ext"], display: "swap" });

/** Localised document metadata from the request's interface language. */
export async function generateMetadata(): Promise<Metadata> {
  const dictionary = getDictionary(await getRequestLocale());
  return {
    title: dictionary.meta.title,
    description: dictionary.meta.description,
    icons: { icon: BRAND_LOGO_PATH },
    robots: { index: false, follow: false },
  };
}

/**
 * Root layout. Order matters: the splash markup is the first element of <body> and its
 * stylesheet is in <head>, so the splash is the first thing painted (mandate §7A.8).
 * `suppressHydrationWarning` on <html>: splash.js sets `data-splash` and the language
 * switcher updates `lang` outside React.
 */
export default async function RootLayout({ children }: { children: ReactNode }): Promise<ReactNode> {
  const locale = await getRequestLocale();
  const dictionary = getDictionary(locale);
  const firstSplashIndex = pickFirstSplashMessageIndex(splashMessages[locale].length);
  // Per-request CSP nonce set by src/proxy.ts; Next.js applies it to its own scripts.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang={locale} className={`${displayFont.variable} ${bodyFont.variable}`} suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href={SPLASH_STYLESHEET_PATH} />
        <noscript>
          <style nonce={nonce}>{"#idss-splash{display:none!important}body>*{visibility:visible!important}"}</style>
        </noscript>
      </head>
      <body>
        <SplashScreen locale={locale} dictionary={dictionary} firstIndex={firstSplashIndex} />
        <I18nProvider initialLocale={locale}>
          {children}
          <SplashReadySignal />
        </I18nProvider>
        <Script src={SPLASH_SCRIPT_PATH} strategy="beforeInteractive" nonce={nonce} />
      </body>
    </html>
  );
}
