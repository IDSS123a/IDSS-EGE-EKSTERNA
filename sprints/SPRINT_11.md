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
Approved 2026-10-04: L1 Vercel on the school account; L2 `matura.idss.ba`; L3 WCAG 2.2 AA; L4 target launch Tuesday
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
