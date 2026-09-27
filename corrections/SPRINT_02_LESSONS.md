# Sprint 02 — Lessons Learned
Date: 2026-09-27 (closed)

## Corrections Applied
1. Grid form inputs overflowed their columns at 1920 px (intrinsic input width) → `width: 100%; min-width: 0` on grid fields. Found on a fixture screenshot, not by tests → P-14 visual check stays mandatory.
2. Bosnian dates rendered as "2026 M09 27" in Chromium (thin ICU data for `bs`) → dates composed from numeric parts with a fixed time zone (Europe/Sarajevo); unit-tested.
3. A server error on any page left the splash on screen forever. After a server-side render error Next.js renders the document on the client and "beforeInteractive" scripts (splash.js) never run, so the splash CSS kept the app hidden. Pre-existing since Sprint 01; found only by the DONE check "every error shows a friendly message" with a deliberately throwing route → `SplashReadySignal` ends the splash when the module never ran, CSS-only fail-safe (14 s) for the no-script case, `/app` error boundary + loading state, page loaders log with location; e2e with every script blocked.
4. The Next.js dev indicator ("Route Static, Bundler Turbopack, Route Info, Preferences", bottom-left, `npm run dev` only) looked like an app defect to the Director → `devIndicators: false` (caught by the Director).

## Gotchas Discovered
- An existing DB test forbids SECURITY DEFINER functions in `public` (lesson 004). Registry write functions are therefore SECURITY INVOKER, executable by `service_role` only; the explicit actor's capability is re-checked by a SECURITY DEFINER helper in `private`.
- Server Actions accept 1 MB bodies by default and Vercel functions about 4.5 MB: large files go browser → storage through a single-use signed upload URL and are verified on the server afterwards.
- Removing a temporary route leaves stale references in `.next/types` and `.next/dev/types`; `tsc` and `next build` fail until they are removed or regenerated.
- `pgrep -f` / `pkill -f` with a pattern that also appears in the running shell command kills that shell (happened twice): stop servers by the PID saved when starting them.
- React production error "#441" on the client is the redacted Server Components error (no message by design); reproduce in `next dev` to read the real one.

## Commander Improvement Candidates
- DONE_CHECKLIST: "Every error shows a user-friendly message" should require forcing one real server error per layout (a throwing route), because an overlay or splash can hide the error UI completely.
- ARCHITECTURE_PATTERNS: "verified direct upload": single-use signed upload to a staging path, server re-reads and verifies (magic bytes, size, hash), content-addressed final path, staging always removed, CSP `connect-src` limited to the signed-upload path prefix.
- ENGINEERING_RULES: when a first-paint overlay hides the app, it needs a fail-safe that works without any JavaScript (CSS animation), not only a JS timer.
