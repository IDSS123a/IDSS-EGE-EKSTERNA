# SPRINT 01 — Foundation: skeleton, identity, canon registry schema, auth

Status: proposed · Prerequisites: Director confirms PDL-001 (stack), answers AMB-01, AMB-03, AMB-06.
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
