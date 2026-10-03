# SPRINT 07 — Mock exams and teacher grading

Status: **in progress** · Started 2026-09-27 (Director: "nastavi sa narednim korakom" after Sprint 06)
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

