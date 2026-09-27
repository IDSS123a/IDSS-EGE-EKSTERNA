import type { ReactNode } from "react";
import {
  BRAND_LOGO_HEIGHT_PX,
  BRAND_LOGO_PATH,
  BRAND_LOGO_WIDTH_PX,
  SPLASH_MAX_VISIBLE_MS,
  SPLASH_MESSAGE_ROTATE_MS,
  SPLASH_MIN_VISIBLE_MS,
} from "@/constants";
import type { Dictionary, Locale } from "@/features/localization/config";
import splashMessages from "../../../../public/splash/messages.json";

/**
 * Server-rendered first-paint splash (mandate §7A.8, DECISION_LOG PDL-007).
 *
 * The markup is part of the very first HTML response, so the official logo and a
 * motivational message paint before any application JavaScript runs. The static module
 * public/splash/splash.js enhances it (WebGL flow field, message rotation, dismissal).
 * Elements that the static script mutates carry `suppressHydrationWarning` on purpose:
 * the script legitimately changes their text/attributes before React hydrates.
 */
export function SplashScreen({
  locale,
  dictionary,
  firstIndex,
}: {
  locale: Locale;
  dictionary: Dictionary;
  /** Index of the first message, chosen per request by `pickFirstSplashMessageIndex`. */
  firstIndex: number;
}): ReactNode {
  const pool = splashMessages[locale];

  return (
    <div
      id="idss-splash"
      role="img"
      aria-label={dictionary.splash.label}
      aria-busy="true"
      data-locale={locale}
      data-min-visible-ms={SPLASH_MIN_VISIBLE_MS}
      data-max-visible-ms={SPLASH_MAX_VISIBLE_MS}
      data-rotate-ms={SPLASH_MESSAGE_ROTATE_MS}
      suppressHydrationWarning
    >
      <canvas className="idss-splash__canvas" data-splash-canvas aria-hidden="true" suppressHydrationWarning />
      <div className="idss-splash__grain" data-splash-grain aria-hidden="true" suppressHydrationWarning />
      <div className="idss-splash__veil" aria-hidden="true" />
      <div className="idss-splash__plate">
        {/* Official IDSS mark (mandate §17) — plain <img> so it is in the first paint, never lazy. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="idss-splash__logo"
          src={BRAND_LOGO_PATH}
          alt={dictionary.splash.logoAlt}
          width={BRAND_LOGO_WIDTH_PX}
          height={BRAND_LOGO_HEIGHT_PX}
          fetchPriority="high"
        />
        <p className="idss-splash__product">{dictionary.splash.product}</p>
        <hr className="idss-splash__rule" />
        <p className="idss-splash__message" data-splash-message data-index={firstIndex} suppressHydrationWarning>
          {pool[firstIndex]}
        </p>
        <div className="idss-splash__progress" aria-hidden="true" />
      </div>
      <script
        id="idss-splash-messages"
        type="application/json"
        // Static, repository-controlled JSON (no user input) — safe to inline.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(splashMessages) }}
      />
    </div>
  );
}
