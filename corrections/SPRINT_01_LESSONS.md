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
- 2026-09-27 — No lessons: routine content change (splash message 10 revised by the Director).
- Supabase project was created under a different Supabase account (mulalic.davor@outlook.com) than the one the session's Supabase connector uses → migrations could not be applied; verified them on local PostgreSQL 16 with a Supabase stub instead → M-4 (second method before claiming DB work done).
- A test that asserts `true` proves nothing: "student update of another profile affected nothing" was replaced by a server-side read of the target row after the attempt (DONE checklist: verify live, not by assumption).
- Supabase grants EXECUTE on new `public` functions to `anon`/`authenticated` by default, so `revoke ... from public` did not stop anonymous RPC calls to SECURITY DEFINER helpers; the local stub lacked that default and all tests passed. Found only by the Supabase security advisor after applying → migration 004 moves helpers to a non-exposed `private` schema; the stub now mirrors the default grant and a test asserts no SECURITY DEFINER function lives in `public` → M-4 (second, independent method caught what the first missed).
- The cloud sandbox's egress policy blocks `*.supabase.co`, so HTTP-level checks against the project are impossible here; equivalent checks were run inside the database with `set local role anon`.

## Commander Improvement Candidates (added)
- ENGINEERING_RULES E-4 / DONE: "Run the Supabase security advisor after every migration" and "SECURITY DEFINER helpers live in a non-exposed schema (`private`), never `public`" — the default Supabase function grants make `public` helpers anonymous RPC endpoints.
- `.gitignore` from create-next-app contains `.env*`, which silently ignored `.env.example`; it never reached GitHub and the Director's local setup failed → added `!.env.example` and verified with `git check-ignore` → A-7 / E-10 (check the committed tree, not the working tree).
- Next.js renders its own `role="alert"` route announcer, so `getByRole("alert")` matched two elements → tests target the form's error by id.
- React 19 resets an uncontrolled form after a Server Action, clearing the username on a failed login → the action echoes the caller's own normalised username (never the password) as `defaultValue`.
- `.card p` outranked `.form__error` (specificity), so the error was not red → scoped the form rules under `.card`; caught only by looking at a screenshot, not by tests.
