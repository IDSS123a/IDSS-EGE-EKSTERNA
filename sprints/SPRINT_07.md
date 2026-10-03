# SPRINT 07 — Mock exams and teacher grading

Status: **closed 2026-10-03** · Started 2026-09-27 (Director: "nastavi sa narednim korakom" after Sprint 06)
Prerequisites met: Sprint 06 closed; 494 trusted questions; confirmed canonical rules for duration, task count, points and
scoring per subject; PDL-018 (the teacher grades mock exams; results after the teacher's confirmation).
Required reading (Tier 2): Commander M-1…M-5, ENGINEERING_RULES, ARCHITECTURE_PATTERNS, C-1…C-5, `CONSTITUTION.md`
(P-3, P-4, P-7, P-13, P-14), `docs/architecture/EXAM_SIMULATION.md`, PDL-018, PDL-024, AMB-09, AMB-10, AMB-21.

## IN
1. **Blueprints as data (AMB-09, AMB-10, AMB-22):** per subject, which catalogue tasks may fill each position of the real
   test, derived from the four official 2026 tests (B/H/S, German) and C12 p.5 (Math); points from the confirmed rules.
   Loaded by the superadministrator, confirmed by a subject reviewer before students can start.
2. **Mock exam:** the student starts a mock exam per subject; the set is generated from trusted catalogue tasks only
   (never repeated inside a set, unseen tasks first) and stored; the official duration runs on the server; answers are
   saved while writing; submission at the end or automatically when time is up.
3. **Grading (PDL-018):** closed items pre-scored with the effective key as a proposal; the subject teacher's queue;
   the teacher grades every open item by the official scoring rules, may change any proposal, and confirms. The student
   sees points, solutions and the teacher's notes only after the confirmation.
4. **Notifications (in the app):** the teacher per submitted mock exam; the student when the result is released.

## OUT
XP and badges on confirmed grades (Sprint 08); daily teacher summary and dashboards (Sprint 09); named sets fixed by a
teacher for a class (later); enrolment points display (AMB-18, when the 2026/27 editions exist); search (carried over).

## Acceptance criteria
- A mock exam has exactly the composition of the real test (18 / 10 / 5 x 4 items), 10 points, the official duration.
- A student never receives a key or solution before the teacher confirms the result (RLS and function tests).
- Only a teacher of the subject (or the superadministrator) grades; every grade and confirmation is audited.

## Progress
- [x] 1. Blueprints: `config/exam-blueprints.json`, evidence `docs/discovery/BLUEPRINT_EVIDENCE.md`
      (`tools/blueprint-evidence/match_tests.py`), PDL-026, AMB-22.
- [x] 2. Migration 019 (applied live 2026-10-03): blueprints and reviews, mock exams, items, pre-scoring, grading, release,
      notifications; DB tests section 18 (31 assertions). German cannot be generated yet: DEU-4.5.6 to 4.5.10 and 4.4.10
      were never reviewed (pending in the review queue).
- [x] 3. Student screens (2026-10-03): `/app/ispit` (per subject: request a set, open exam, earlier exams) and
      `/app/ispit/[id]` (waiting for approval, start, countdown on the server clock, autosave every 20 s, submission,
      automatic submission at the deadline, result after grading with printed key, teacher notes and errata). Mock
      exams open for students once the blueprints are loaded and confirmed (item 4).
- [x] 4. Teacher screens (2026-10-03): `/app/ocjenjivanje` with sets awaiting approval, exams to grade and recent
      results; blueprints per subject loaded from `config/exam-blueprints.json` (canon.publish, identified by SHA-256)
      and confirmed or rejected by the subject reviewer (positions, points and catalogue ranges shown for comparison
      with C12, C15, C16); `/app/ocjenjivanje/[id]`: approval or discard (with reason, optional new set) after seeing
      every question with its printed key, errata and open follow-ups; grading beside the printed key with
      pre-scored proposals, pairs for matching, notes, then result confirmation. Live probe: all three blueprints pass
      load_exam_blueprint (rolled back). Next: the Director loads the blueprints, the three subject teachers confirm.
- [x] 5. Canon fidelity (P-15, PDL-027, Director 2026-10-03): question crops for all 500 extracted questions
      (`tools/question-images`, verified word by word), practice shows the crop and errata notices; migrations 020 and
      021 applied live (printed key only, errata, follow-ups, teacher verdicts on practice answers); 022 and 023 (set
      approval, grading by pairs) run by the Director in the SQL editor on 2026-10-03 and verified live.
- [x] 6. Director 03.10.2026: DEU-4.4.10 and 4.5.6 to 4.5.10 accepted provisionally under the Director's account with an
      open follow-up "Nikolina Todorović" each (review before official use); live: 500 of 500 catalogue questions
      trusted, dialogue tasks answered by choice 1/2/3 and checked by the printed key.
- [x] 7. Review screen per P-15 (2026-10-03): errata form (record and withdraw, optional German statement), follow-ups
      (request, mark as checked), "Open notices" per subject on the queue (shows the six "Čeka: Nikolina Todorović");
      text and key revision forms removed, earlier rows shown as history only. Erratum DEU-4.3.34 is entered by the
      Director in this form.
- [x] 8. Commander upgraded to v1.6.2 (Director: "obavezno nadograditi", PDL-028): four Learned-From additions,
      no new rules; automation identical to v1.6.1, so only the version stamps changed.
- [x] 9. Notifications in the app (IN 4, found missing at close-out): panel on the student Game Hub (result released)
      and in the teacher grading area (exam submitted), mark as read; unused text-revision proposal helpers removed.

## DONE_CHECKLIST (Commander 1.6.2) - 2026-10-03

Evidence: typecheck PASS, lint PASS (0 warnings), `check:text` PASS (72 files), project guard scan clean, Vitest 138/138,
`npm run test:db` PASS (sections 17 to 19), build PASS, Playwright 68/68, security advisor: only the known Auth WARN
(leaked-password protection); live: migrations 019 to 023 applied and verified, 500/500 trusted questions, blueprint load
probed for all three subjects inside a rolled-back block.

| Area | Item | Result |
|---|---|---|
| Code quality | tsc zero errors; no `any` / `@ts-ignore` / `console.log` / TODO in new code | PASS |
| | No hard-coded values (paths, autosave interval, notification limit are constants; colours are tokens) | PASS |
| | No unused code | PASS after fix (text-revision proposal helpers removed with their test) |
| | Browser console on changed screens | PARTIAL: every new screen rendered with fixture data in Chromium (one hydration mismatch found and fixed); not yet used live, because sign-in needs the Director's local keys. The Director's first blueprint load and DEU-4.3.34 erratum are the live check. |
| Architecture | Queries only in repositories (`exams`, `grading`, `notifications`, `review`); permissions in `lib/permissions.ts` (`canGrade`, `canGradeSubject`); domain logic framework-free (`exams/domain/exam.ts`, `grading/domain/blueprint.ts`) | PASS |
| | Blueprints are data with provenance (config by SHA-256, reviewer confirmation), nothing hard-coded (P-4, P-15) | PASS |
| Security | Server Actions: authenticate, authorise with subject scope, Zod; database functions re-check scope (service_role only) | PASS |
| | RLS on every table (DB test "RLS enabled on every public table after 020"); students get no question before the start and no key or points before the teacher confirms (payload rules, DB tests 18 and 19) | PASS |
| | IDOR: exam pages answer another student's or another subject's exam like a missing one (database binds by person and subject) | PASS |
| | Live adversarial pass | PASS for grants (all new functions service_role only, DB tests); not yet with live student and teacher sessions |
| Error handling | try/catch; failed writes audited (`auditIfFailed`); machine codes localised in bs/de/en | PASS |
| UX | Loading and empty states; errors with recovery; countdown, autosave and automatic submission; 320 to 2560 px layout e2e | PASS |
| | Sprint IN items visible to their users | PASS after fix (notifications panel added at close-out) |
| Documentation | JSDoc on actions and exports; schema-audit 019 to 023; CHANGELOG; PDL-026 to PDL-028; P-15; AMB-22 resolved, AMB-23 | PASS |
| | `.env.example` | PASS (no new variable) |
| Build/deploy | Build green; no new dependency | PASS |
| | Test data | PASS (live probes rolled back; follow-ups and acceptances are the Director's real actions) |
| Post-deploy | Production URL | N/A (not deployed; Director: later) |
| Learning | `corrections/SPRINT_07_LESSONS.md` consolidated | PASS |

COMMANDER COMPLIANCE - Sprint 07
──────────────────────────────────
Rules followed without reminder:        25/31 (M-2, M-3, M-4, M-5, M-13, M-18, M-21, M-23, P-4, P-13, P-14, E-1, E-2, E-3, E-4, E-5, E-6, E-9, E-11, E-13, A-2, A-3, A-4, A-5, A-8)
Rules violated, caught by ACA:          4 (E-10: notifications stored but not shown, found at close-out; A-1: proposal helpers left unused after the forms were removed; E-10: hydration mismatch from Intl locale data; E-10: German pool gap found only through the empty Kommunikation pool)
Rules violated, caught by Director:     3 (P-4/P-15: canon corrections by revision and an IDSS area rule, superseded by P-15; E-10: practice mode not explained on screen; E-10: browser password manager on the account form)
Rules that slowed work or felt wrong:   none (the connector's DROP confirmation slowed migrations 022 and 023; worked around through the SQL editor)
New rules suggested by this sprint:     3 (see Commander Improvement Candidates in the lessons file)

HANDOFF NOTE - Sprint 07
Completed: exam blueprints as data from the official 2026 tests and C12 (PDL-026); migrations 019 to 023 (mock exams, pre-scoring, grading, release, notifications, canon fidelity with printed key only, errata, follow-ups, set approval, grading by pairs); P-15 canon fidelity with 500 catalogue crops; six German records accepted provisionally with follow-ups for Nikolina Todorović; review screen with errata, follow-ups and open notices; student mock exam screens (request, approval wait, start, server-clock countdown, autosave, automatic submission, result); teacher screens (blueprint load and confirmation, set approval or discard, grading beside the printed key, result confirmation); in-app notifications; Commander v1.6.2 (PDL-028).
Not completed: blueprints not yet loaded and confirmed live (the Director loads, the three subject teachers confirm); erratum DEU-4.3.34 not yet entered (the Director, in the review screen); teacher queue for open practice answers (migration 021 is live, no screen yet); search (parked since Sprint 06).
Open risks: no screen of this sprint has been used live with real sign-ins; the six German records wait for Nikolina Todorović; AMB-21 (key formats for matching and completion) keeps those tasks with the teacher; leaked-password protection is still off.
Technical debt: shadcn/ui deviation (PDL-010); Sentry deferred; Vercel deployment postponed; notification for sets awaiting approval exists only as the queue (no notification kind).
Lessons captured: 20 entries in corrections/SPRINT_07_LESSONS.md.
Next sprint: Sprint 08 - Live rollout of mock exams and motivation: the Director's live walk-through (blueprints loaded and confirmed, one mock exam per subject from request to released result, DEU-4.3.34 erratum); teacher queue for open practice answers (migration 021); XP and badges on confirmed grades only (P-7); notification when a set waits for approval; leaked-password protection on.
