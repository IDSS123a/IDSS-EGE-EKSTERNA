# SPRINT 03 — Ingestion pipeline: TypeScript extractor, parser profiles, ingestion jobs

Status: **in progress** · Started 2026-09-27 ("kreni Sprint 03", Director)
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

Open for the Director: on `/app/kanon`, click "Izdvoji pitanja" on each of the three catalogues and
check the counts (Matematika 200/200, B/H/S 200 + 20 dodatnih, Njemački 80 zadataka / 200 bodovnih
jedinica); the sandbox cannot reach Supabase Storage, so the first real run is the Director's.
