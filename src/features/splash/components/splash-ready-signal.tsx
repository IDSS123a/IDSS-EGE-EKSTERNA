"use client";

import { useEffect } from "react";

/**
 * Tells the static splash that the React app has hydrated and is interactive, so the
 * splash can leave as soon as its minimum display time has passed (mandate §7A.8:
 * never block the app unnecessarily). Renders nothing.
 */
export function SplashReadySignal(): null {
  useEffect(() => {
    if (window.IDSSSplash) {
      window.IDSSSplash.ready();
      return;
    }
    // splash.js is loaded "beforeInteractive"; this path only covers a slow script fetch.
    const onLoad = (): void => window.IDSSSplash?.ready();
    window.addEventListener("load", onLoad, { once: true });
    return () => window.removeEventListener("load", onLoad);
  }, []);
  return null;
}
