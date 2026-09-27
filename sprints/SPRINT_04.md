# SPRINT 04 — Review & knowledge: subjects, scoped teachers, review queue, trusted questions

Status: **in progress** · Started 2026-09-27 ("kreni Sprint 04", Director)
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
