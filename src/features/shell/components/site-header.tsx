"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { BRAND_LOGO_HEIGHT_PX, BRAND_LOGO_PATH, BRAND_LOGO_WIDTH_PX } from "@/constants";
import { useI18n } from "@/features/localization/i18n-provider";
import { LanguageSwitcher } from "@/features/localization/language-switcher";

/** Shared top bar: official IDSS logo (links home) and the live language switcher. */
export function SiteHeader({ actions }: { actions?: ReactNode }): ReactNode {
  const { dictionary } = useI18n();
  return (
    <header className="site-header">
      <Link href="/" className="site-header__brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="site-header__logo"
          src={BRAND_LOGO_PATH}
          alt={dictionary.splash.logoAlt}
          width={BRAND_LOGO_WIDTH_PX}
          height={BRAND_LOGO_HEIGHT_PX}
        />
      </Link>
      <div className="site-header__actions">
        {actions}
        <LanguageSwitcher />
      </div>
    </header>
  );
}
