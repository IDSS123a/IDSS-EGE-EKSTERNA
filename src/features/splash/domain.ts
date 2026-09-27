/**
 * Pick the message index rendered in the first paint. Randomised per request so returning
 * users see variety; public/splash/splash.js then guarantees no immediate repeat of the
 * previous load's message and a non-repeating rotation (mandate §7A.8).
 * @param poolSize number of messages in the active locale's pool
 * @returns an index in [0, poolSize)
 */
export function pickFirstSplashMessageIndex(poolSize: number): number {
  return poolSize > 0 ? Math.floor(Math.random() * poolSize) : 0;
}
