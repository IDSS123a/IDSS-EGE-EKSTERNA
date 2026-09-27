# SPRINT 01 — Foundation: skeleton, identity, canon registry schema, auth

Status: **closed 2026-09-27** · Prerequisites met: PDL-001 confirmed; AMB-01…16 answered by the Director.
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
- [ ] 7. Seed named staff accounts — **handed to the Director**: created in `/app/nalozi` with personally chosen initial passwords; bundles per AMB-16. Not blocking sprint close (data entry, not code).
- [x] 8. Integration tests (RLS: `npm run test:db` 33/33 locally), rate-limit boundary tests (unit, N allowed / N+1 blocked), nonce CSP (`src/proxy.ts`, e2e incl. an injected-script attack), live adversarial pass on Supabase (forged uid, anon, direct self-escalation, audit deletion), migration 005 (performance advisor).

Verification so far: `npm run typecheck`, `npm run lint`, `npm run build` green;
`PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:e2e` → 8/8 (desktop + mobile):
splash in first HTML before app content, official logo, pool message, security headers,
splash leaves and app appears with zero console errors, live language switch without reload
+ persistence, reduced-motion path. Dev-mode run: zero hydration warnings.

## DONE_CHECKLIST (Commander 1.6.1) — 2026-09-27

Evidence: `npm run typecheck` ✔ · `npm run lint` ✔ · Vitest 19/19 · `npm run test:db` 33/33 ·
`npm run build` ✔ · Playwright 24/24 (desktop + mobile) · `npm prune --omit=dev && npm run start` → HTTP 200 ·
project guard clean · Supabase security advisor: 1 WARN (dashboard setting, below) · performance advisor: INFO only.

| Area | Item | Result |
|---|---|---|
| Code quality | tsc zero errors; no `any`, `@ts-ignore`, `as unknown as` | PASS |
| | No hard-coded hex/px in components, no inline `style={{}}` (tokens in CSS) | PASS |
| | No TODO, no `console.log` (structured logger only) | PASS |
| | Browser console at error level on every changed screen, incl. dev mode | PASS (0 errors, 0 hydration warnings) |
| Architecture | No DB query in UI; queries only in `repository.ts`; permissions only in `lib/permissions.ts`; top-down deps | PASS |
| | Feature folders per A-2 | PASS |
| | Shadcn/UI (DL-011) | **DEVIATION** — plain components + tokens so far; recorded as PDL-010, revisit in Sprint 06 (Game Hub) |
| Security | Every action: authenticate → authorise → Zod → execute → standard result | PASS |
| | RLS on every table, deny-by-default, no `USING (true)` on personal data | PASS (capability catalogues readable by signed-in users only) |
| | IDOR: targets re-checked server-side (`canChangeAccount`, service role only after authorisation) | PASS |
| | No secret in `NEXT_PUBLIC_*`; service role only in `supabase-admin.ts` | PASS |
| | Auth rate limited; no CORS surface (no API routes); CSP + security headers | PASS |
| | Uploads validated | N/A (no uploads yet — Sprint 02) |
| | Live adversarial pass before real data (forged token, self-update of role, cross-role read) | PASS (live SQL on Supabase + e2e forged cookie) |
| | "Exempt role" claims verified by failing them | PASS (blocked Superadmin loses every capability — test) |
| Error handling | try/catch on async, logged with context; friendly messages; standard result shape | PASS |
| | Every write-operation error logged to `audit_log` | **PARTIAL** — failures go to the structured server log (and `security_events` for sign-in); audit rows only for successful writes. Follow-up in Sprint 02 |
| Monitoring | Sentry from project start (E-8, DL-006) | **FAIL (deferred)** — needs a Sentry account/DSN (new external service → Director decision, M-4) |
| UX | Loading, error and empty states; mobile; labels/keyboard; reduced motion | PASS |
| | Performance claims | N/A (none made) |
| Documentation | JSDoc on exports and actions; schema-audit; `.env.example`; constants; CHANGELOG; DECISION_LOG | PASS |
| Build/deploy | Build green; production start without devDependencies | PASS |
| | Test data | PASS — live tests ran in rolled-back transactions; the only rows are the Director's real account and its audit trail |
| | Rate limit boundary N / N+1 | PASS (unit) |
| Post-deploy | Production URL checks | N/A — not deployed yet (Vercel deployment needs Director approval, M-4) |
| Learning | `corrections/SPRINT_01_LESSONS.md` | PASS |

Open items for the Director:
1. Supabase → Authentication → Passwords: enable **leaked password protection** (security advisor WARN).
2. Supabase → Authentication → Sign In / Providers: **Allow new users to sign up = OFF** (if not done yet).
3. Decide on Sentry (free tier) — needs an account; until then errors are in the structured server log.

COMMANDER COMPLIANCE — Sprint 01
──────────────────────────────────
Rules followed without reminder:        24/28 (M-2, M-3, M-4, M-5, M-7, M-9, M-10, M-14, M-15, M-18, M-23, E-1, E-2, E-3, E-4, E-5, E-6, E-9, E-10, E-11, E-15, A-3, A-4, A-7)
Rules violated, caught by ACA:          4 (A-8/E-4 default function grants → migration 004; A-7 `.env.example` ignored; M-4 two vacuous live checks; E-15 LCP fade-in)
Rules violated, caught by Director:     1 (A-7 — surfaced by the Director's failed `copy .env.example`)
Rules that slowed work or felt wrong:   DL-011 shadcn/ui for a handful of simple forms; E-8 Sentry "from project start" needs an external account the ACA cannot create
New rules suggested by this sprint:     see corrections/SPRINT_01_LESSONS.md (Commander Improvement Candidates, 5)

HANDOFF NOTE — Sprint 01
Completed: Next.js 16 app, design tokens, first-paint splash (official logo, WebGL IDSS flow, 12 messages × 3 languages), live bs/de/en switch, Supabase schema 001–005 (identity, capabilities, canon registry, append-only audit, RLS), username + password sign-in with lockout and audit, Superadmin bootstrap, account administration, nonce CSP, live adversarial pass.
Not completed: staff account creation (Director data entry); Sentry (decision); audit rows for failed writes (Sprint 02).
Open risks: sign-in and account administration were exercised live only by the Director's own login — the account screen has not yet been used live; sandbox cannot reach Supabase over HTTP, so live UI flows depend on the Director's local runs until a Vercel preview exists.
Technical debt: shadcn/ui deviation (PDL-010); `subject_teacher` bundles wait for canon-derived subjects (AMB-16).
Lessons captured: 12 corrections + 8 gotchas + 5 improvement candidates in corrections/SPRINT_01_LESSONS.md.
Next sprint: Sprint 02 — Canon registry: Superadmin upload (magic bytes, SHA-256, private storage), metadata, version lifecycle, `activate_canon_version()`, history and rollback; seed the three current catalogues as active versions (AMB-02).
