# Sprint 01 — Lessons Learned
Date: 2026-09-27 (closed)

## Corrections Applied
1. Splash plate overflowed a 390 px viewport (content-box width + padding) → `box-sizing: border-box` scoped to the splash → C-7 (never desktop-only).
2. Splash palette showed two colours and orange (a wide red→yellow blend) → cyclic palette with narrow transitions; verified over three animation moments, not one frame → M-4.
3. Splash plate faded in from opacity 0 → removed; the LCP element must never fade in → E-15.
4. `Math.random()` in a component render failed the React purity rule → moved to a domain helper called once per request.
5. A DB test asserted `true` ("student update of another profile affected nothing") → replaced by reading the target row afterwards → DONE checklist (verify, don't assume).
6. Supabase grants EXECUTE on new `public` functions to `anon`/`authenticated`; SECURITY DEFINER helpers became anonymous RPC endpoints. The local stub lacked that default, so all tests passed; the Supabase security advisor caught it → migration 004 (`private` schema), stub now mirrors the grant, test asserts no SECURITY DEFINER in `public` → M-4 (independent second method).
7. `.gitignore` from create-next-app (`.env*`) silently ignored `.env.example`; the Director's local setup failed → `!.env.example`, verified with `git check-ignore` → A-7 / E-10.
8. React 19 resets an uncontrolled form after a Server Action, clearing the username → the action echoes the caller's own normalised username (never the password).
9. `.card p` outranked `.form__error` (specificity) — found only on a screenshot → form rules scoped under `.card`.
10. `ilike` on usernames treats `_`/`%` as wildcards → usernames stored lower-case and compared with `eq`.
11. Two "live" checks were vacuous before being fixed: the first live SQL pass looked up the Superadmin id *after* switching to the `authenticated` role (RLS hid it, `auth.uid()` was null), and the first CSP negative test used Playwright `evaluate` (DevTools bypasses CSP). Both were redone so the attack path is the real one (id resolved before the role switch; payload injected into the served HTML) → M-4.
12. Supabase performance advisor: per-row `auth.uid()` and duplicated permissive policies → migration 005 (merged policies, `(select auth.uid())`, FK indexes), semantics re-verified locally (33/33) and live.

## Gotchas Discovered
- Next.js 16: `middleware` → `proxy`; request APIs async only; `AGENTS.md` points to bundled docs; nonces require dynamic rendering and are applied from the request's CSP header.
- `@playwright/test` latest expects browser build 1243; the sandbox ships 1194 → `PW_CHROMIUM_PATH`, never `playwright install`.
- Next.js renders its own `role="alert"` route announcer → target form errors by id in tests.
- Server Actions used with `useActionState` must take `(previousState, formData)`.
- Scripts that mutate server-rendered markup before hydration need `suppressHydrationWarning` on exactly those elements.
- The session's Supabase connector initially pointed at a different Supabase account than the project owner's; reconnecting the connector fixed it without a new session.
- The cloud sandbox cannot reach `*.supabase.co` over HTTP; database checks run through the Supabase MCP (`set local role …`), and live sign-in is verified by the Director locally.
- Supabase Auth "leaked password protection" is a dashboard setting (not reachable via MCP/SQL).

## Commander Improvement Candidates
- ARCHITECTURE_PATTERNS: a "first-paint splash" pattern — static module in `public/`, server-rendered markup, `html[data-*]` phase attribute, `ready()` handshake, fail-safe max time, `<noscript>` override, CSP nonce on the script.
- ENGINEERING_RULES E-4 / DONE: run the Supabase security **and performance** advisors after every migration; SECURITY DEFINER helpers live in a non-exposed `private` schema.
- DONE checklist: a live adversarial check must first prove the identity it impersonates is actually in effect (e.g. assert `auth.uid()` is the target id) — otherwise a "0 rows" result is vacuous.
- DONE checklist: CSP negative tests must inject the payload into the served document; browser automation `evaluate` bypasses CSP.
- initial_instructions Step 3.3: document a fallback for cloud ACAs whose safety policy blocks executing externally fetched code until the Director approves it.

## Routine entries
- No lessons: splash message 10 revised by the Director; AMB-15 student password length set to 10.

## Post-close corrections (Director, 2026-09-27)
13. UI text written by the ACA carried AI tells (em dashes, the ellipsis character, middle dots, an arrow) → Director rule P-13 (PDL-011); rule list as data, `npm run check:text` in CI, runtime filter `src/lib/text-style.ts` for generated text → M-4 (mechanical enforcement, not memory).
- Gotcha: project-guard patterns scan the whole repository (only path excludes), so a character rule there would also flag canonical catalogue text and docs; app-text rules need their own scoped check.
- Gotcha: a local 404 on a new route usually means the local copy predates the merge that added it (`git pull` + restart `npm run dev`), not a routing bug; signed-out visitors are redirected, never shown 404.

## Commander Improvement Candidates (post-close)
- ENGINEERING_RULES: an "AI tells" style rule for product text generated by ACAs or by in-app AI (character + phrase list as data, scoped CI check, runtime filter).
