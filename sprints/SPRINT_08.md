# SPRINT 08 — Mock exams live, teacher review of practice answers, motivation

Status: **closed 2026-10-03** · Started 2026-10-03 (Director: "uredu. nastavi po planu" after the Sprint 07 handoff)
Prerequisites met: Sprint 07 closed; PR #39 merged; migrations 019 to 023 live; 500/500 trusted questions.
Required reading (Tier 2): Commander M-1…M-5, ENGINEERING_RULES, ARCHITECTURE_PATTERNS, `CONSTITUTION.md` (P-4, P-7, P-13,
P-14, P-15), PDL-018, PDL-024, PDL-027, mandate §8.3 and §8.4.

## IN
1. **Live walk-through (Director):** blueprints loaded and confirmed by the three subject teachers; one mock exam per
   subject from request to released result; erratum DEU-4.3.34 entered in the review screen.
2. **Teacher review of open practice answers:** the subject teacher's queue of practice answers awaiting a verdict
   (migration 021 `practice_review_queue`, `review_practice_answer`), with the printed key and errata beside the answer.
3. **Notification when a set waits for approval:** teachers of the subject (superadministrators when none) are notified
   when a student requests a set.
4. **XP and badges (P-7, mandate §8.3, §8.4):** event-driven, never part of scoring, never shown as a grade; values are
   a Director decision (the mandate sets none), recorded before implementation.
5. **Leaked-password protection** in Supabase Auth (security advisor WARN since Sprint 01).

## OUT
Levels, challenges and leaderboards (later); search (parked); daily teacher summary and dashboards (Sprint 09).

## Acceptance criteria
- A teacher sees only practice answers of the subjects they grade; a verdict is audited and changes the student's
  practice outcome, never a mock exam score.
- Every notification has a recipient even when the subject has no teacher.
- XP is stored apart from scores; a test proves that no XP event changes points or results.

## Progress
- [x] 2. Teacher review of open practice answers (2026-10-03): `/app/ocjenjivanje/vjezba` with the question as printed,
      the student's answer beside the printed key and errata, verdict correct / partly correct / incorrect with an
      optional note (review_practice_answer, audited); the grading area links to it with the waiting count. Live: 7
      answers wait (payload checked through practice_review_queue).
- [x] 3. Set request notification: migration 024 run by the Director in the SQL editor on 2026-10-03 ("Success. No rows
      returned"), verified live (kind check includes mock_exam_requested), history row 20261003150000 recorded;
      security advisor: only the known Auth WARN.
- [x] 4. XP and badges (PDL-029): migration 025 applied live (`gamification_overview`, read-only, derived from the
      student's own events, values from `config/gamification.json`); Game Hub panel with XP total, sources and five
      badges, marked as motivation, not a grade; DB tests prove that reading XP changes no score.
- [x] 5. Leaked-password protection: Supabase offers it only on Pro plans (Director's screenshot), so the application
      checks every new password against the Pwned Passwords range API (PDL-030, k-anonymity) on account creation,
      reset and own change; unit tests with a fake service (the API is not reachable from the build sandbox).
- [x] 6. User guide source per participant (PDL-031): `docs/user-guide/` with chapters for everyone, students, subject
      teachers, the superadministrator, pedagogue and psychologist, personal start pages for Nizama Memija, Nikolina
      Todorović, Haris Hamzić, Davor Mulalić, Medina Karaga and Adnana Agić, and the screenshot list; stale status
      texts on the public and staff home pages replaced.
- [x] 7. Director: "IDSS bodovi" instead of "XP" in every app text (bs, de, en) and in the guide.
- [x] 8. Pedagogue and psychologist screens: design approved (PDL-032, D1 to D5, readiness scale, AMB-24 resolved);
      implementation is Sprint 09.
- [x] 1. Live walk-through, first part (Director, 2026-10-03): the three blueprints loaded live through the grading
      screen (version 2026-10-03.1, SHA-256 identical to the repository). Confirmation by the subject teachers,
      erratum DEU-4.3.34 and the first live mock exam move to Sprint 09.

## DONE_CHECKLIST (Commander 1.6.2) - 2026-10-03

Evidence: typecheck PASS, lint PASS, `check:text` PASS (75 files), project guard scan clean, Vitest 145/145,
`npm run test:db` PASS (024 and 025 applied, sections 18 and 20), build PASS, Playwright 68/68, security advisor: only the
Auth WARN (leaked-password protection, Pro plan only, mitigated in the app by PDL-030); live: migration 024 (Director) and
025 applied, IDSS points of the trial student checked (114 answer points = 9 x 10 + 12 x 2), blueprints loaded by the
Director with matching SHA-256.

| Area | Item | Result |
|---|---|---|
| Code quality | tsc zero errors; no `any` / `@ts-ignore` / `console.log` / TODO in new code; no unused code | PASS |
| | No hard-coded values (IDSS point values in `config/gamification.json`, HIBP URL and timeout, notification limit are constants) | PASS |
| | Browser console on changed screens | PASS on the production build; dev-mode CSP noise equal to the login page |
| Architecture | Queries in repositories (`grading`, `gamification`, `notifications`); permissions in `lib/permissions.ts`; domain logic framework-free (`xp.ts`) | PASS |
| | IDSS points never touch scoring (read-only stable function, DB test) | PASS |
| Security | Server Actions: authenticate, authorise, Zod; new database functions service_role only | PASS |
| | Leaked-password check on every password set (create, reset, own change); only a 5-character hash prefix leaves the server | PASS |
| | Teacher sees only practice answers of graded subjects (database scope) | PASS |
| Error handling | try/catch; failed writes audited; HIBP fails open with a log | PASS |
| UX | Loading, empty and error states in bs/de/en; "IDSS bodovi" everywhere; motivation never shown as a grade | PASS |
| Documentation | JSDoc; schema-audit 024, 025; CHANGELOG; PDL-029 to PDL-032; AMB-24; user guide source (PDL-031) | PASS |
| Build/deploy | Build green; no new dependency | PASS |
| | Test data | PASS (no live probe left data; the blueprints are the Director's real action) |
| Post-deploy | Production URL | N/A (not deployed) |
| Learning | `corrections/SPRINT_08_LESSONS.md` consolidated | PASS |

COMMANDER COMPLIANCE - Sprint 08
──────────────────────────────────
Rules followed without reminder:        26/30 (M-2, M-3, M-4, M-5, M-13, M-18, M-21, M-23, P-4, P-7, P-13, P-14, P-15, E-1, E-2, E-3, E-4, E-5, E-6, E-9, E-11, E-13, A-2, A-3, A-4, A-5)
Rules violated, caught by ACA:          3 (E-10: test file braces cut by rstrip; E-10: stale status texts found while writing the guide; E-10: ambiguity row with missing columns)
Rules violated, caught by Director:     1 (product vocabulary: "XP" replaced by "IDSS bodovi")
Rules that slowed work or felt wrong:   none
New rules suggested by this sprint:     2 (see Commander Improvement Candidates)

HANDOFF NOTE - Sprint 08
Completed: teacher review of practice answers; set request notifications (migration 024, live); leaked-password check in the application (PDL-030); IDSS points and badges on the Game Hub (migration 025, live, PDL-029, renamed from XP by the Director); user guide source per participant (PDL-031); support monitoring design approved with the IDSS readiness scale (PDL-032, AMB-24 resolved); blueprints loaded live by the Director.
Not completed: blueprint confirmation by Nizama Memija, Haris Hamzić and Nikolina Todorović; erratum DEU-4.3.34; first live mock exam from request to released result.
Open risks: no mock exam has run live yet; six German records still wait for Nikolina Todorović; the HIBP check has not run against the live service from this sandbox (it runs from the Director's machine and the server).
Technical debt: shadcn/ui deviation (PDL-010); Sentry deferred; Vercel deployment postponed; in-app printable guide waits for stable screens.
Lessons captured: 10 entries in corrections/SPRINT_08_LESSONS.md.
Next sprint: Sprint 09 - Support monitoring for the pedagogue and the psychologist (SUPPORT_MONITORING.md, PDL-032): student overview with user-set filters, student profile with the five dimensions, persistent errors, activity calendar, mock exam trend and the IDSS readiness indicator, group analysis (aggregates only), support notes with visibility and audit, print and CSV export; plus the carried-over live walk-through.

**Correction (2026-10-03, Sprint 09):** the Playwright result above was measured before the home status texts were
replaced; that change made the language-switch test fail (2 of 68). Found and fixed in Sprint 09 (test expectation
updated, 68/68 again); see `corrections/SPRINT_09_LESSONS.md`.
