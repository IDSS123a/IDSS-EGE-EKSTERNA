# SPRINT 01 — Foundation: skeleton, identity, canon registry schema, auth

Status: **in progress** (started 2026-09-27) · Prerequisites met: PDL-001 confirmed; AMB-01…12 answered by the Director.
Required reading (Tier 2): Commander M-1…M-5, ENGINEERING_RULES, ARCHITECTURE_PATTERNS, C-1…C-5,
`CONSTITUTION.md`, this document, `docs/architecture/*`.

## IN
1. Next.js App Router scaffold at repo root (`src/`, feature folders per ARCHITECTURE §3), TypeScript strict, Tailwind, shadcn/ui, ESLint, Vitest, Playwright.
2. Design tokens (`src/styles/tokens.css`) from the IDSS palette as semantic tokens; light/dark; reduced-motion token.
3. **Splash screen** (P-8): official logo, 12 mandate messages seeded into `splash_messages`, non-repeating rotation, `prefers-reduced-motion` variant, paints before app shell.
4. Supabase project (Director approves creation/costs) + migrations:
   `001_identity` (profiles, capabilities, grants, persons, school_years, cohorts, enrolments),
   `002_canon_registry` (document types, documents, versions, canon_generation — schema only),
   `003_audit` (audit_logs, security_events), RLS deny-by-default + `has_capability()`.
5. Auth: username + password login (PDL-003), logout, session cookie flags, uniform errors, rate limit + lockout, security headers middleware.
6. Superadmin account lifecycle UI: create, activate, suspend, block/unblock, deactivate, archive; capability grants; every action audited; token-expiry limitation shown (P-12).
7. Seed: the six named staff accounts (invited state; passwords set by first-login flow), capability bundles per `ROLES_AND_PERMISSIONS.md`.
8. Tests: unit (permissions), integration (RLS: forged token, wrong role, direct call), e2e (login → splash → role landing), rate-limit boundary N / N+1.

## OUT
Canon upload UI, ingestion, question bank, practice, gamification, AI (Sprints 02+).

## Acceptance criteria
- Unauthenticated request to any app route/action is rejected; no fail-open path.
- A student cannot read another student's rows (RLS test) or call admin actions.
- Superadmin can create and block an account; the event appears in the audit log.
- Splash shows before the login screen, rotates without immediate repeats, and is static under reduced motion.
- `npx tsc --noEmit`, lint, unit/integration/e2e green; `npm run build` green.

## Progress
- [x] 1. Next.js 16 App Router scaffold at repo root, TypeScript strict, Tailwind 4, ESLint, Playwright (Vitest and shadcn/ui arrive with steps 4–6)
- [x] 2. Design tokens (`src/app/globals.css`, `docs/DESIGN_SYSTEM.md`)
- [x] 3. Splash screen — final version in `public/splash/` with the official logo (`public/brand/`), 12 messages × bs/de/en, non-repeating rotation, reduced motion, WebGL/CSS/no-JS fallbacks; server-rendered first paint in the root layout
- [x] (added by AMB-11) Live language switch bs/de/en without reload, persisted in a preference cookie
- [x] Baseline security headers (`next.config.ts`); nonce CSP pending step 5
- [x] 4. Supabase project `dezevstfmfliyasdeflj` (Director). Migrations 001–004 applied 2026-09-27; Supabase security advisor clean after 004 (moved SECURITY DEFINER helpers out of the exposed schema). Local `npm run test:db` 33/33; live SQL checks as `anon` return 0 rows everywhere.
- [x] 5. Username + password auth (`/prijava`, `/app`, `src/proxy.ts`): Supabase Auth with server-verified `getUser()`, role/status from the database on every request, HTTP-only SameSite=Strict session cookies, lockout after 5 failures per username / 20 per IP in 15 min, uniform error for unknown user / wrong password / inactive account, security events + audit log, logout. Superadmin bootstrap script (`npm run accounts:bootstrap`, run by the Director locally). CSP still pending (nonce via proxy) — moved to step 6.
      Verified here without a reachable database: unit 11/11 (rules, boundary N/N+1, schema), e2e 16/16 (redirects, forged cookie, validation, fail-closed, i18n of errors). **Live sign-in against Supabase must be verified by the Director locally** (sandbox egress blocks supabase.co).
- [x] 6. Superadmin account lifecycle UI (`/app/nalozi`): create administrator/student accounts (students get a longitudinal `persons` row), set status (active/suspended/blocked/deactivated/archived — also banned/unbanned at Supabase Auth), grant/revoke pedagogue / psychologist / admin_operations bundles, reset passwords; no self-change, Superadmin not editable; every action audited; bs/de/en. Verified: unit 18/18, e2e 18/18; live use by the Director pending. CSP still pending → step 8.
- [ ] 7. Seed named staff accounts — done by the Director in `/app/nalozi` (initial passwords chosen and handed over personally); bundles per AMB-16.
- [ ] 8. Integration tests (RLS), rate-limit boundary tests

Verification so far: `npm run typecheck`, `npm run lint`, `npm run build` green;
`PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:e2e` → 8/8 (desktop + mobile):
splash in first HTML before app content, official logo, pool message, security headers,
splash leaves and app appears with zero console errors, live language switch without reload
+ persistence, reduced-motion path. Dev-mode run: zero hydration warnings.
