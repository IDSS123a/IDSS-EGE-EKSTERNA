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
- [ ] 2. Upload action
- [ ] 3. Registry screen
- [ ] 4. Audit rows for failed writes
- [ ] 5. Catalogue seed script
- [ ] 6. Tests
