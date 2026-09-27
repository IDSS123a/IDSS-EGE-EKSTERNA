# Sprint 01 — Lessons Learned
Date: 2026-09-27 (in progress)

## Corrections Applied
- Splash plate overflowed a 390px viewport: `width: min(88vw, 520px)` plus padding in content-box sizing → `box-sizing: border-box` scoped to the splash → C-7 (never desktop-only).
- A linear 4-stop palette over an fbm field showed mostly two colours; a wide red→yellow blend produced orange (not an IDSS colour) → cyclic palette with narrow transitions → verified over three animation moments, not one frame (M-4 second method).
- `Math.random()` inside a component render failed the React purity lint rule → selection moved to a domain helper called once per request in the layout.
- The splash's rise animation initially faded opacity from 0 → removed; LCP element must never fade in (E-15).

## Gotchas Discovered
- Next.js 16: `middleware` is renamed `proxy`; request APIs are async only; `next-env.d.ts` is git-ignored by the generator. `AGENTS.md` points to the bundled docs.
- `@playwright/test` latest expects browser build 1243; the sandbox ships 1194 → pass `executablePath` (`PW_CHROMIUM_PATH`), never `playwright install`.
- Headless Chromium through the sandbox proxy cannot load Google Fonts in a static preview (`ERR_CERT_AUTHORITY_INVALID`); `next/font` self-hosts at build time, so the app itself is unaffected.
- Scripts that mutate server-rendered markup before hydration need `suppressHydrationWarning` on exactly the mutated elements; verified with zero warnings in dev mode.

## Commander Improvement Candidates
- ARCHITECTURE_PATTERNS: add a "first-paint splash" pattern — static module in `public/`, server-rendered markup, `html[data-*]` phase attribute, `ready()` handshake from the app, fail-safe max time, no-JS `<noscript>` override.
