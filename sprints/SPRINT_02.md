# SPRINT 02 — Canon registry: upload, version lifecycle, history, rollback

Status: **in progress** · Started 2026-09-27 ("kreni Sprint 02", Director)
Prerequisites met: Sprint 01 closed; AMB-02 (catalogues valid until MOOKS issues new ones).
Required reading (Tier 2): Commander M-1…M-5, ENGINEERING_RULES, ARCHITECTURE_PATTERNS, C-1…C-5,
`CONSTITUTION.md` (incl. P-13, P-14), this document, `docs/architecture/DATA_MODEL.md` §2.

## IN
1. Migration `006_canon_lifecycle`: private storage bucket `canon-documents` (PDF, 50 MB),
   `canonical_version_events` (append-only history), `canonical_dependencies` (dependency map),
   write functions `register_canon_version`, `activate_canon_version` (activate + rollback),
   `set_canon_version_status` (reject, archive). Service role only; actor capability re-checked;
   every transition writes a history event and an audit row in the same transaction.
2. Superadmin upload (Server Action): magic bytes (`%PDF-`), size limit, SHA-256, duplicate check,
   private storage, metadata form (type, document title, issuing authority, official title,
   reference number, dates, revision label). New document or new version of an existing one.
3. Registry screen `/app/kanon`: documents with their versions and statuses, activate, reject,
   roll back (with reason), archive superseded versions, history per document, dependency view
   (what the document type feeds + count of derived records), signed short-lived download.
4. Audit rows for failed writes (carry-over from Sprint 01 DONE item "PARTIAL").
5. Seed the three current catalogues as active versions (AMB-02): `npm run canon:seed`, run by the
   Director locally (the sandbox cannot reach Supabase Storage). Metadata taken from the PDFs
   themselves; nothing invented.
6. Tests: DB (lifecycle, invariants, grants), unit (magic bytes, hashing, schemas, transitions),
   e2e (access control of `/app/kanon`, P-13/P-14 checks).

## OUT
Parsing/ingestion of uploaded files (Sprint 03), review queue (Sprint 04), any student-facing canon view.

## Acceptance criteria
- upload, activate, supersede and rollback demonstrated; nothing is deleted.
- Never two active versions of one document (database invariant).
- A non-PDF, a renamed non-PDF, an oversized file or a duplicate file is refused with a clear message.
- Only `canon.publish` can change the registry; `canon.review` may read; students see nothing new.
- Every transition is in the history and in the audit log, failed attempts included.

## Progress
- [x] 1. Migration 006 written; local `npm run test:db` 63/63 (30 new lifecycle assertions);
      applied to Supabase `dezevstfmfliyasdeflj`; security advisor: only the known dashboard WARN
      (leaked password protection); performance advisor: INFO (unused indexes on an empty database);
      live grants verified (anon/authenticated cannot execute the lifecycle functions).
- [x] 2. Upload in two steps (PDF can exceed a request body): `prepareCanonUploadAction` issues a
      single-use signed upload URL for `staging/<uuid>.pdf`; the browser PUTs the file directly (CSP
      `connect-src` opens only `<project>/storage/v1/object/upload/sign/canon-documents/`);
      `registerCanonVersionAction` reads the staged bytes on the server, checks PDF signature, size,
      SHA-256 and duplicates, stores `sources/<sha256>.pdf`, calls `register_canon_version`, and always
      removes the staging object (and an orphaned source on failure).
- [x] 3. Registry screen `/app/kanon` (bs/de/en, P-13 clean, P-14 full width): upload form (new document
      or new version), documents with versions, status, metadata, SHA-256, size, derived-record counts,
      what the type feeds, activate / reject / restore (rollback) / archive with reason and confirmation,
      history per document, signed 60 s download (`/app/kanon/preuzmi/[versionId]`, audited).
      Link on `/app` for canon.publish / canon.review holders.
- [x] 4. Failed writes audited (`<action>_failed`, code only) for canon and account actions (`src/features/audit/failures.ts`).
- [x] 5. `npm run canon:seed` with manifest `tools/canon-seed/catalogues.json` (metadata from the PDFs,
      expected SHA-256). **Run by the Director locally** (sandbox has no HTTP access to Supabase).
- [x] 6. Tests: DB 63/63; Vitest 34/34 (signature, size boundary, SHA-256 vector, transitions, reasons,
      error mapping, schemas, CSP prefix, manifest matches the repository PDFs, date format);
      Playwright 40/40 (registry and download fail closed without a session and with a forged cookie,
      CSP connect-src restricted; the CSP e2e is meaningful only where NEXT_PUBLIC_SUPABASE_URL is set,
      the unit test covers the builder). Screen checked with fixture data at 1920 px and 390 px:
      no horizontal scroll, 0 console errors.

Open for the Director:
- run `npm run canon:seed`, then open `/app/kanon` and try one upload + activate + restore on a test PDF
  (live verification of the signed upload path, which the sandbox cannot reach).

Known debt: staging objects of uploads that were never registered stay in `staging/` (private,
unreferenced); a clean-up job belongs to Sprint 03 ingestion jobs.
