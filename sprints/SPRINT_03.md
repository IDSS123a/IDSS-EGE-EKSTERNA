# SPRINT 03 — Ingestion pipeline: TypeScript extractor, parser profiles, ingestion jobs

Status: **closed 2026-09-27** · Started 2026-09-27 ("kreni Sprint 03", Director)
Prerequisites met: Sprint 02 closed; the three catalogues are active versions (AMB-02).
Required reading (Tier 2): Commander M-1…M-5, ENGINEERING_RULES, ARCHITECTURE_PATTERNS, C-1…C-5,
`CONSTITUTION.md` (incl. P-13, P-14), this document, `docs/architecture/DATA_MODEL.md` §3–4,
`tools/canon-ingestion/output/INGESTION_REPORT.md` (the regression reference).

## IN
1. TypeScript extractor on pdf.js (PDL-013): PDF text layer as lines, parser profiles per catalogue
   edition (data, bound by SHA-256), extractors for Mathematics, B/H/S, German ported from the
   Sprint 00 reference tool.
2. Regression: 200/200/200 units (German: 80 tasks, 200 scored items; B/H/S + 20 supplementary)
   with identical IDs and keys to the golden reference.
3. Migration 007: ingestion jobs (state, profile, extractor version, counts, report) and ingested
   records (untrusted, structural status, full record), written only by the server in one transaction.
4. Run ingestion on an active version from `/app/kanon` (canon.publish); job report per version.
5. Clean-up of abandoned staging uploads (Sprint 02 debt).
6. OCR decision: recorded in PDL-013 (not needed now).

## OUT
Semantic review, trusted records, subjects/areas as rows, answer-key revisions (Sprint 04).
Nothing extracted here is shown to students.

## Acceptance criteria
- `tests/unit/ingestion-regression.test.ts` passes: identical IDs, keys and content for all 500 records.
- An ingestion job on an active version stores all records as `untrusted_pending_review` with a report.
- A file without a profile or without a text layer produces a failed job with a clear reason.
- Only canon.publish can start ingestion; canon.review can read jobs; students see nothing.

## Progress
- [x] 1. `src/features/ingestion/pdf-lines.ts` (pdf.js line model: tab-gap split at 1.05 font sizes,
      scripts within 0.55 font sizes, emphasis from font names, image pages), parser profiles
      `config/parser-profiles.json`, extractors `domain/{mathematics,bhs,german}.ts`.
- [x] 2. Regression test: all 500 records identical (whitespace-insensitive text); negative check
      (a broken German key split) fails the test.
- [x] 3. Migration 007 (`canonical_ingestion_jobs`, `ingested_records`, `record_ingestion_job`), local DB
      tests (20 new), applied to Supabase; advisor clean; live rollback check with real records.
- [x] 4. `runIngestionAction` (canon.publish): SHA-256 re-check of the stored file, profile by exact edition,
      extraction, report, one-transaction write; failed runs stored with NO_PROFILE / INTEGRITY /
      SOURCE_MISSING / UNREADABLE_PDF / NO_TEXT_LAYER. Panel per version on `/app/kanon` with counts,
      declared-total check and review notes translated into bs/de/en. Verified inside a production
      Next.js server: 1.2 to 2.5 s per catalogue, counts identical to the reference.
- [x] 5. Stale staging uploads (older than 24 h) removed when the next upload is prepared.

Live verification (2026-09-27): the Director ran "Izdvoji pitanja" on the three catalogues (screen
print received). Evidence in the database: 3 succeeded jobs, 500 records, all `untrusted_pending_review`,
500 current dependency rows, 3 audit rows `canon.ingestion_succeeded`, 0 failures; counts Math 200/200,
B/H/S 200 + 20, German 80 / 200. MD5 fingerprint of record IDs and answer keys (whitespace removed, in
source order) computed in the database equals the one computed from the Sprint 00 reference for all three
catalogues (ce448a7a…, 0084bc8c…, c961e087…).

Additional work in the sprint: review of nine new ministry documents (SOURCE_INVENTORY C20 to C24,
AMB-18), exam simulation design (`docs/architecture/EXAM_SIMULATION.md`), AMB-17 decided (PDL-014),
catalogue files renamed to one pattern (same SHA-256).

## DONE_CHECKLIST (Commander 1.6.1) — 2026-09-27

Evidence: typecheck ✔ · lint ✔ · `check:text` ✔ · Vitest 43/43 (incl. 500-record regression) · `npm run test:db` ✔ (20 new
assertions) · build ✔ · Playwright 42/42 · `npm prune --omit=dev && npm run start` → `/` 200, `/app/kanon` 307 (pdfjs-dist is a
runtime dependency) · project guard clean · security advisor: only the known Auth WARN · performance advisor: INFO only ·
live: 3 jobs, fingerprints equal to the reference.

| Area | Item | Result |
|---|---|---|
| Code quality | tsc zero errors; no `any` / `@ts-ignore` / `as unknown as` in new code | PASS |
| | No hard-coded values: line-model thresholds and staging limits are named constants with their measurement | PASS |
| | No TODO; no `console.log` in routes or actions (CLI seed output only) | PASS |
| | Browser console at error level on changed screens | PASS (fixture render 0 errors; Director's live screen) |
| Architecture | Queries only in repositories; permissions in `lib/permissions.ts`; domain framework-free | PASS |
| | No AI SDK call | N/A (extraction is deterministic, no AI) |
| | Feature folder `features/ingestion` per A-2 | PASS |
| | Schema used by several layers (record shape: extractor, RPC, panel, Sprint 04): shape fixed to the Sprint 00 reference, round trip verified live by fingerprint | PASS |
| Security | Server Action: authenticate, authorise (canon.publish), Zod; DB function re-checks the actor | PASS |
| | RLS on new tables, read only with canon.publish / canon.review; students see nothing | PASS (DB tests) |
| | IDOR: version re-read server-side; stored file SHA-256 re-checked before extraction | PASS |
| | No secrets client-side; service role only after authorisation | PASS |
| | Uploads | unchanged from Sprint 02 (PASS); PDFs parsed server-side only for registered, SHA-verified files |
| | Live adversarial pass | PASS (grants: anon/authenticated cannot execute `record_ingestion_job`, verified live) |
| Error handling | try/catch on async paths; failed runs stored as failed jobs with a reason; failed attempts audited | PASS |
| | No raw errors to users; localised codes | PASS |
| UX | Loading state ("Izdvajanje u toku"), confirmation, result line, failure reason, review notes in bs/de/en | PASS |
| | Empty state ("Pitanja iz ove verzije još nisu izdvojena.") | PASS |
| | Mobile 390 px, no horizontal scroll | PASS |
| | Accessibility: labels, live region, 44 px summary targets | PASS |
| | Performance claims | measured, not claimed: 1.2 to 2.5 s per catalogue in a production server (sandbox) |
| Documentation | JSDoc on exports (fixed at close); schema-audit; CHANGELOG; DECISION_LOG PDL-013 (new dependency) and PDL-014 | PASS |
| | `.env.example` | N/A (no new variable) |
| Build/deploy | Build green; new dependency `pdfjs-dist` recorded (PDL-013) and in `dependencies` | PASS |
| | Cleanup checks errors (staging clean-up logs failures, never throws) | PASS |
| | Test data | PASS (live write check ran in a rolled-back transaction, 0 rows left; the 3 live jobs are real data) |
| | Rate limit N / N+1 | N/A (no new rate limit; ingestion is Superadmin-only) |
| Post-deploy | Production URL | N/A (not deployed; Vercel needs Director approval, M-4) |
| Learning | `corrections/SPRINT_03_LESSONS.md` | PASS |

Open items for the Director (unchanged): leaked password protection in Supabase Auth; Sentry decision.

COMMANDER COMPLIANCE — Sprint 03
──────────────────────────────────
Rules followed without reminder:        27/29 (M-2, M-3, M-4, M-5, M-7, M-9, M-10, M-13, M-14, M-15, M-18, M-23, E-1, E-2, E-3, E-4, E-5, E-6, E-9, E-10, E-11, E-13, E-14, E-15, A-3, A-4, A-8)
Rules violated, caught by ACA:          2 (M-4: Sprint 02 live claim written without data evidence, found in the audit log; E-10: broken JSON edit caught before commit)
Rules violated, caught by Director:     0 (the local ENOENT surfaced a script weakness, fixed)
Rules that slowed work or felt wrong:   none
New rules suggested by this sprint:     see corrections/SPRINT_03_LESSONS.md (Commander Improvement Candidates, 3)

HANDOFF NOTE — Sprint 03
Completed: in-app catalogue ingestion on pdf.js with parser profiles bound to the exact editions (PDL-013); regression test proving identical IDs, keys and content to the Sprint 00 reference for all 500 records; migration 007 (append-only jobs and untrusted records, one-transaction write function, dependency map); "Izdvoji pitanja" with report and review notes on `/app/kanon`; stale staging clean-up; live run by the Director verified by database fingerprints; nine new ministry documents reviewed; exam simulation design and AMB-17 decision (PDL-014); catalogue files renamed.
Not completed: nothing from the sprint scope.
Open risks: new catalogue editions need a reviewed parser profile before ingestion (by design, fails closed); B/H/S task types (MC, matching, completion) are derived from wording and must be confirmed in review before blueprints use them (AMB-10); the 2026/27 calendar and enrolment criteria are not yet published (AMB-18).
Technical debt: shadcn/ui deviation (PDL-010); `subject_teacher` bundles wait for subject rows (AMB-16, Sprint 04); Sentry deferred.
Lessons captured: 11 entries in corrections/SPRINT_03_LESSONS.md.
Next sprint: Sprint 04 — Review & knowledge: subject rows from the rulebook, subject-teacher access per subject (AMB-16), review queue showing each record beside its rendered source region, trust decisions and answer-key revisions (never overwriting the printed key), canonical rules with page quotes; first trusted questions reviewed by Haris Hamzić, Nizama Memija and Nikolina Todorović.
