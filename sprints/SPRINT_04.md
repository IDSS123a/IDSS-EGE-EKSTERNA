# SPRINT 04 — Review & knowledge: subjects, scoped teachers, review queue, trusted questions

Status: **closed 2026-09-27** · Started 2026-09-27 ("kreni Sprint 04", Director)
Prerequisites met: Sprint 03 closed; 3 active catalogue versions with 500 untrusted ingested records.
Required reading (Tier 2): Commander M-1…M-5, ENGINEERING_RULES, ARCHITECTURE_PATTERNS, C-1…C-5,
`CONSTITUTION.md` (incl. P-13, P-14), this document, `docs/architecture/DATA_MODEL.md` §4,
`docs/architecture/ROLES_AND_PERMISSIONS.md`, `docs/architecture/EXAM_SIMULATION.md`, AMB-09, AMB-10, AMB-16.

## IN
1. **Canonical facts with page quotes** (PDL-015): the three exam subjects and the exam rules
   (duration, total points, composition, scoring, allowed and forbidden aids, Math level blueprint)
   as data in `config/canonical-facts.json`, bound to the exact catalogue edition by SHA-256. Every
   quote is verified verbatim against the stored PDF on its page, by a unit test and again on the
   server when the facts are loaded. Legal basis of the three subjects: Pravilnik Art. 5 (C1/C2).
2. **Migration 008**: `subjects`, `subject_areas`, `canonical_rules` (with review status),
   `record_reviews` (append-only trust decisions), `questions`, `question_versions` (trusted copies),
   `answer_keys` (printed key, never changed), `answer_key_revisions` (append-only reviewed
   corrections, CF-03); subject foreign keys for `profile_bundles` and `canonical_documents`;
   subject-scoped actor check; service-role-only write functions with audit rows.
3. **Subject-scoped teachers** (AMB-16): the account screen grants `subject_teacher` for one subject.
4. **Review queue** `/app/pregled`: per subject in the reviewer's scope, records of the latest
   succeeded ingestion job of the active version, each shown beside its rendered source region
   (pdf.js in the browser, from the stored, SHA-verified file). Decisions: accept (task type
   confirmed, AMB-10) or return with a reason. Accepting creates the trusted question version and
   its printed answer keys in the same transaction.
5. **Answer-key revisions** on accepted questions: corrected answer, reason, evidence; the printed
   key stays as printed; the latest revision is the effective key.
6. **Rules review**: subject teachers confirm or dispute each canonical rule of their subject
   (AMB-09 Math blueprint by Haris Hamzić).

## OUT
Showing questions to students (Sprint 06), blueprints and mock exams (Sprint 07), competency mapping,
RAG, OCR of scanned ministry documents (PDL-013).

## Acceptance criteria
- Every quote in `config/canonical-facts.json` is found verbatim on its page (unit test); a changed
  quote fails the test and is refused by the server.
- A subject teacher sees and reviews only records and rules of their own subject; another subject
  is FORBIDDEN in the application and in the database (DB tests).
- Accepting a record creates exactly one trusted question version with its printed keys; a second
  decision on an accepted record is refused; returning requires a reason.
- A key revision never changes `answer_keys`; history is append-only (DB tests).
- Students and anonymous users read nothing of the new tables.

## Progress
- [x] 1. `config/canonical-facts.json` (3 editions, 20 rules, every quote found on its page by
      `tests/unit/knowledge.test.ts`); "Učitaj predmet i pravila" on `/app/kanon` re-checks SHA-256 and all quotes
      on the stored file before `load_canonical_facts`.
- [x] 2. Migration 008 applied to Supabase; `npm run test:db` 45 new assertions; security advisor only the known
      Auth WARN, performance advisor INFO only; live grants: anon/authenticated cannot execute the new functions.
- [x] 3. `/app/nalozi`: "Predmetni nastavnik (predmet)" per subject; accounts carry subject scopes
      (`subjectScopes`, twin of `private.has_capability(code, subject)`).
- [x] 4. `/app/pregled`: subject tabs (own subjects only), filters, progress, paging; record screen with the source
      region rendered by pdf.js (legacy build) from `/app/pregled/izvor/[versionId]` (same origin, SHA-256
      re-checked, subject scope), whole-page toggle, sideways scroll inside the frame on phones; accept with
      confirmed task type (AMB-10) or return with reason; history.
- [x] 5. Key revisions on accepted questions: printed key unchanged, newest revision is the effective key.
- [x] 6. `/app/pregled/pravila`: rules with quotes, readable values, page view, confirm or dispute with note.

Verified in the sandbox: typecheck, lint, `check:text`, Vitest 62/62, `npm run test:db`, build, Playwright 54/54
(new `tests/e2e/review.spec.ts`), fixture renders of Math, German and rules screens at 1440 px and 390 px (no
horizontal page scroll).

Live verification (2026-09-27, evidence from the database): subjects `bhs_language_literature` (7 rules),
`mathematics` (7), `german` (6) loaded by the Director with "Učitaj predmet i pravila"; subject-teacher grants
haris.hamzic (mathematics), nizama.memija (bhs_language_literature), nikolina.todorovic (german). 
Review decisions (2026-09-27): the Director accepted 2 records and confirmed all 20 rules individually in the
review screens; then, by the Director's order (PDL-016), ACA accepted the remaining 492 records in one transaction
with the tag "Skupno prihvatanje po nalogu direktora, bez pojedinačnog pregleda". Database: 494 trusted question
versions, 576 printed keys, 25 subject areas, 494 + 40 audit rows; 6 German records of unrecognised type pending.

## DONE_CHECKLIST (Commander 1.6.1) — 2026-09-27

Evidence: typecheck ✔ · lint ✔ · `check:text` ✔ · Vitest 62/62 · `npm run test:db` ✔ (45 new assertions) · build ✔ ·
Playwright 54/54 · security advisor: only the known Auth WARN · performance advisor: INFO only · live: 3 subjects,
20 rules, 3 scoped grants, 494 trusted questions, 576 printed keys (database queries).

| Area | Item | Result |
|---|---|---|
| Code quality | tsc zero errors; no `any` / `@ts-ignore` / `as unknown as` in new code | PASS |
| | No hard-coded values | PASS after fix (canvas outline and page colour moved to constant and token, correction 2) |
| | No TODO; no `console.log` in routes or actions (a temporary debug log was removed before commit) | PASS |
| | Browser console on changed screens | PASS (fixture renders of record, German task, rules at 1440 and 390 px: no errors; only pdf.js font-hinting warnings; account and registry screens used live by the Director) |
| Architecture | Queries only in repositories (a page-level query moved into `knowledge/repository.ts`); permissions in `lib/permissions.ts`; domain framework-free | PASS |
| | No AI SDK call | N/A |
| | Feature folders `features/knowledge`, `features/review` per A-2 | PASS |
| | Multi-layer schema (record shape, rule value, subject scopes): consumers enumerated (DB function, repository, screens); round trip verified live (accepted records → question versions and keys counted in the database) | PASS |
| Security | Server Actions: authenticate, authorise with subject scope, Zod; DB functions re-check the actor against the object's own subject | PASS |
| | RLS on 9 new tables; review material only for publishers and reviewers of that subject; students and anon read nothing | PASS (DB tests) |
| | IDOR: record and source routes answer a foreign subject like a missing record; form subjectId is only a pre-check | PASS |
| | Service role only after authorisation; no secrets client-side; source PDF same-origin, SHA-256 re-checked | PASS |
| | Uploads | unchanged (PASS) |
| | Live adversarial pass | PASS (grants: anon/authenticated cannot execute the 5 new functions, verified live; forged cookie e2e) |
| Error handling | try/catch on async paths; failed attempts audited (`auditIfFailed`); machine codes mapped, localised messages | PASS |
| UX | Loading states (source "Učitavanje stranice", buttons disabled while pending); empty states (no subjects, no scope, no queue, empty filter, no rules) | PASS |
| | Mobile 390 px, no horizontal page scroll (source frame scrolls inside) | PASS |
| | Accessibility: labels, live regions, aria-current tabs, canvas with role img and label, 44 px targets | PASS |
| | Performance claims | none made |
| Documentation | JSDoc on exports, routes and actions; schema-audit 008; CHANGELOG; DECISION_LOG PDL-015, PDL-016; constants | PASS |
| | `.env.example` | N/A (no new variable) |
| Build/deploy | Build green; no new dependency (pdfjs-dist already runtime, PDL-013) | PASS |
| | Test data | PASS (no test rows written live; the bulk acceptance is real data by Director order, PDL-016) |
| | Rate limit N / N+1 | N/A |
| Post-deploy | Production URL | N/A (not deployed; Director: later) |
| Learning | `corrections/SPRINT_04_LESSONS.md` | PASS |

COMMANDER COMPLIANCE — Sprint 04
──────────────────────────────────
Rules followed without reminder:        28/31 (M-2, M-3, M-4, M-5, M-7, M-9, M-10, M-13, M-14, M-15, M-18, M-23, E-1, E-2, E-3, E-4, E-5, E-6, E-9, E-10, E-11, E-13, E-14, A-2, A-3, A-4, A-8, A-10)
Rules violated, caught by ACA:          3 (E-9 hard-coded colours, found at the checklist; A-3 query in a page, moved before commit; M-4 bulk write did not read existing rule decisions, reported and recorded)
Rules violated, caught by Director:     0 (the "buttons not visible" report was a missing pull, recorded as a hand-off gotcha)
Rules that slowed work or felt wrong:   none
New rules suggested by this sprint:     see corrections/SPRINT_04_LESSONS.md (Commander Improvement Candidates, 3)

HANDOFF NOTE — Sprint 04
Completed: canonical facts (subjects and 20 exam rules) with verbatim page quotes bound to the catalogue editions and verified by test and on the server (PDL-015); migration 008 (subjects, areas, rules and rule reviews, record reviews, trusted question versions, printed keys, key revisions, scoped write functions); subject-teacher rights per subject; review queue with the original page region rendered beside each record; answer-key revisions that never touch the printed key; rules review; live: facts loaded, three teachers granted, 494 questions trusted (2 individually, 492 in bulk by Director order, tagged, PDL-016).
Not completed: individual review by the subject teachers (the app is not reachable outside the Director's computer until the Vercel deployment, which the Director postponed); 6 German records of unrecognised type remain pending.
Open risks: 492 questions were accepted without per-item comparison (184 Math tasks with 2-D notation, B/H/S task types AMB-10, Math blueprint AMB-09 confirmed without the teachers); a record cannot be un-accepted, only its key revised; proposal: re-review flag for bulk-accepted questions in Sprint 06.
Technical debt: `question_options` / `scored_items` kept as JSON in `question_versions` (PDL-015); shadcn/ui deviation (PDL-010); Sentry deferred; leaked-password protection still off in Supabase Auth.
Lessons captured: 7 entries in corrections/SPRINT_04_LESSONS.md.
Next sprint: Sprint 05 — Retrieval (RAG) per IMPLEMENTATION_PLAN: chunks of trusted records and rules, retrieval with an active-version filter, retrieval audit, provider interface, refusal behaviour, injection tests; needs a Director decision on the embedding/AI provider.

