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
- [ ] 1. Canonical facts config + quote verification
- [ ] 2. Migration 008 + DB tests + advisors
- [ ] 3. Scoped subject-teacher grants
- [ ] 4. Review queue with source region, trust decisions
- [ ] 5. Answer-key revisions
- [ ] 6. Rules review
