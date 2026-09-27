/**
 * Shared TypeScript types (Commander E-1).
 */

/** Public API of the static first-paint splash module (public/splash/splash.js). */
export type SplashController = {
  /** App is interactive — the splash leaves once its minimum display time has passed. */
  ready: () => void;
  /** Leave immediately. */
  dismiss: () => void;
  /** Switch the rotating messages to another interface language. */
  setLocale: (locale: string) => void;
};

declare global {
  interface Window {
    IDSSSplash?: SplashController;
  }
}
