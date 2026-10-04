# SPRINT 11 — Hardening and launch

Status: **in progress** · Started 2026-10-04 (Director approved L1 to L4, PDL-041; target launch 2026-10-06)
Source: `docs/IMPLEMENTATION_PLAN.md` row 11; CONSTITUTION P-13, P-14; Commander E-15, M-4, M-23; PDL-038 (clean start).
Required reading (Tier 2): Commander M-1…M-5, ENGINEERING_RULES, ARCHITECTURE_PATTERNS, DONE_CHECKLIST (post-deploy
verification), `docs/PRODUCTION_READINESS.md`.

## IN
1. **Accessibility audit** of every screen (keyboard only, screen reader names, contrast, focus, reduced motion,
   200 % zoom, phone and desktop); automated axe checks added to e2e for the main screens; findings fixed.
2. **Security adversarial pass**: forged and expired tokens, self-escalation (own role, own rights, own status),
   cross-role reads (student to student, teacher to another subject, pedagogue to teacher notes, Director to support
   notes), direct calls to every `service_role` function from `anon` and `authenticated`, CSV formula injection,
   upload of a non-PDF, rate limits; each case as a DB test or e2e test; security advisor clean.
3. **Performance** (E-15): production build measured on a phone profile; heavy parts (3D Vitrina, search) load only
   where used; database queries of the command centers checked with `explain` on realistic counts.
4. **Deployment preparation**: hosting project, environment variables (Supabase, Gemini, VAPID) set by the Director in
   the hosting settings, never in chat; Supabase Auth URLs for the production domain; error pages; post-deploy checklist.
5. **Clean start** (PDL-038, D-A), the very last step before the deploy: archive export of the test-phase audit, the
   reviewed cleanup migration run by the Director, verification.
6. **Production deploy** only on the Director's explicit go (M-23), then the post-deploy verification.

## OUT
Classes and generations beyond IX 2026/27 (wait for the school's labels); e-mail or SMS notices; paid services.

## Decisions of the Director (PDL-041)
Approved 2026-10-04: L1 Vercel on the school account; L2 Vercel team `idsssarajevo` on the free Vercel address (`matura.idss.ba` possibly later); L3 WCAG 2.2 AA; L4 target launch Tuesday
2026-10-06, clean start the day before.

- **L1 Hosting.** Proposal: Vercel (PDL-001), free Hobby plan while the school tests, under the school's own account;
  the Director creates the account and enters the keys there himself.
- **L2 Address.** Proposal: a subdomain of the school, e.g. `matura.idss.ba` (DNS entry by whoever manages idss.ba);
  until then the free Vercel address.
- **L3 Accessibility level.** Proposal: WCAG 2.2 level AA.
- **L4 Launch date.** The Director sets it once the teachers have confirmed the exam blueprints and the erratum
  DEU-4.3.34 and testing is finished; the clean start runs the day before.

## Acceptance criteria
- Every adversarial case is refused and covered by a test.
- axe reports no serious or critical issue on the main screens; layout spec green on every viewport (P-14).
- After the clean start only canon, configuration and staff accounts remain (inventory counts zero).
- Post-deploy verification of DONE_CHECKLIST passes on the production address.

## Progress
- [x] 0. Draft plan with decisions L1 to L4.
- [x] 0a. Decisions L1 to L4 recorded (PDL-041).
- [x] 0b. Migration 030 run by the Director, verified live; every migration 001 to 034 is in the database.
- [x] 0c. Director: VAPID keys are in `.env.local`; hosting team `idsssarajevo` (no project for this repository yet, checked 2026-10-04); deployment steps in README.
- [x] 1. Accessibility (WCAG 2.2 AA): `tests/e2e/accessibility.spec.ts` (axe, public pages, bs/de/en, desktop and phone,
  stable over 4 repeats); signed-in screens checked with fixtures (Game Hub, practice, staff home, Postavke, Director
  tabs): two findings fixed (badge contrast, keyboard access to scroll tables); keyboard focus visible globally.
- [x] 2. Security adversarial pass (2026-10-04):
  - Live, as `anon`: zero rows in every sensitive table (profiles, audit log, support and teacher notes, gifts,
    practice answers, security events, push subscriptions).
  - Live, as an authenticated student (rolled back): own role to superadmin 0 rows; own staff bundle refused (42501);
    write or erase the audit log refused or 0 rows; Director functions posing as the Director refused (42501);
    support notes, teacher notes, audit log and other students' answers 0 rows; profiles only the own row.
  - Live catalogue: no public function executable by anon or authenticated; RLS on every public table; no write policy
    for the API roles. DB section 28 now guards these invariants for every future migration.
  - App layer: every action takes the actor from the session, never from the form; account changes refuse the own
    account and superadmins; staff bundles only for administrators (existing unit tests); forged session cookie and
    CSP injection covered by e2e; CSV formula injection covered by unit tests.
  - Direct calls to the public API from this environment are blocked by its network policy; the same checks ran inside
    the database under the API roles.
- [x] 0d. Director: launch 2026-10-06 goes ahead without the teachers' blueprint confirmations and erratum DEU-4.3.34 (done after launch).
