"use client";

import { useEffect } from "react";

/**
 * Tells the static splash that the React app has hydrated and is interactive, so the
 * splash can leave as soon as its minimum display time has passed (mandate §7A.8:
 * never block the app unnecessarily). Renders nothing.
 *
 * If the splash module never ran (a failed script fetch, or a server error after which the
 * document is rendered on the client and "beforeInteractive" scripts are not executed), the
 * splash is ended here so the app, or its error message, is never hidden behind it.
 */
export function SplashReadySignal(): null {
  useEffect(() => {
    const settle = (): void => {
      if (window.IDSSSplash) window.IDSSSplash.ready();
      else document.documentElement.setAttribute("data-splash", "done");
    };
    if (window.IDSSSplash || document.readyState === "complete") {
      settle();
      return;
    }
    // splash.js is loaded "beforeInteractive"; this path only covers a slow script fetch.
    window.addEventListener("load", settle, { once: true });
    return () => window.removeEventListener("load", settle);
  }, []);
  return null;
}
