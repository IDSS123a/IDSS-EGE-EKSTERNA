# SPRINT 02 — Canon registry: upload, version lifecycle, history, rollback

Status: **closed 2026-09-27** · Started 2026-09-27 ("kreni Sprint 02", Director)
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

Live verification (Director, 2026-09-27): `npm run canon:seed` ran; the three catalogues are active in
`/app/kanon`. Corrected 2026-09-27 (Sprint 03) from the live audit log: five manual uploads reached the
server through the signed upload path and were correctly refused as `DUPLICATE_FILE` (the same catalogue
files), so the direct upload and server-side verification are proven live; activating and restoring a
second version has not been exercised live yet (covered by the DB tests).

Known debt: staging objects of uploads that were never registered stay in `staging/` (private,
unreferenced); a clean-up job belongs to Sprint 03 ingestion jobs.

## DONE_CHECKLIST (Commander 1.6.1) — 2026-09-27

Evidence: `npm run typecheck` ✔ · `npm run lint` ✔ · `npm run check:text` ✔ · Vitest 34/34 · `npm run test:db` 63/63 ·
`npm run build` ✔ · Playwright 42/42 (desktop + mobile) · `npm prune --omit=dev && npm run start` → `/` 200, `/app/kanon` 307 to login ·
project guard clean · Supabase security advisor: 1 WARN (dashboard setting, known) · performance advisor: INFO only ·
live: Director seeded and exercised the registry.

| Area | Item | Result |
|---|---|---|
| Code quality | tsc zero errors; no `any`, `@ts-ignore`, `as unknown as` in new code | PASS |
| | No hard-coded hex/px in components, no inline styles; constants in `constants/index.ts` | PASS |
| | No TODO; no `console.log` in routes or actions (CLI seed script output only) | PASS |
| | Browser console at error level on changed screens | PASS (fixture render 0 errors; error route verified) |
| Architecture | No DB query in UI; queries only in `canon/repository.ts`; permissions in `lib/permissions.ts` | PASS |
| | No AI SDK call | N/A |
| | Feature folders per A-2 (`features/canon`, `features/audit`) | PASS |
| | Config/schema used by several layers: types, repository, DB functions enumerated; round trip (upload, register, read back, transition) tested in DB tests and live | PASS |
| Security | Every Server Action and the download route: authenticate, authorise, validate (Zod) | PASS |
| | RLS deny-by-default on new tables; write paths callable by `service_role` only, actor re-checked | PASS (live grants verified) |
| | IDOR: versions read under RLS; lifecycle target status re-read server-side | PASS |
| | No secret in `NEXT_PUBLIC_*`; service role only after authorisation | PASS |
| | File uploads: type by magic bytes (stronger than MIME), bucket MIME allow-list, size limit on ticket, bucket and stored bytes; extension irrelevant (content-addressed `.pdf`) | PASS |
| | CSV/Excel export | N/A |
| | Live adversarial pass before real data | PASS (Sprint 01 pass still valid; new write paths: anon/authenticated denied live, forged cookie e2e) |
| | "Exempt role" claims verified by failing them | PASS (blocked Superadmin and canon.review holder denied in DB tests) |
| Error handling | try/catch on async paths; page loaders log with location and rethrow to the boundary | PASS (after fix, correction 3) |
| | Every write error to `audit_log` | PASS (`<action>_failed` rows for canon and accounts; Sprint 01 PARTIAL closed) |
| | No raw error to users; standard result shape `{ success, data | code }` | PASS (verified: thrown message not leaked) |
| UX | Loading states (upload phases, pending buttons, `/app` loading) | PASS |
| | Friendly error with recovery (localised codes; `/app` error boundary with retry) | PASS (after fix) |
| | Empty states | PASS (empty registry, empty history) |
| | Mobile | PASS (390 px, no horizontal scroll) |
| | Accessibility: labels, live regions, keyboard, 44 px targets | PASS |
| | Visual verification with a real capture | PASS (screenshots, fail-safe e2e) |
| | Performance claims | N/A (none made) |
| Documentation | JSDoc on exports, actions and route; `schema-audit.md`; constants; CHANGELOG | PASS |
| | `.env.example` | N/A (no new variable) |
| | DECISION_LOG | PASS (no new technology; upload pattern recorded in lessons and PR) |
| Build/deploy | Build green; no new dependency; production start without devDependencies | PASS |
| | Cleanup checks errors (staging and orphan removal log failures) | PASS |
| | Test data | PASS (DB tests in a throw-away database; the live registry holds only the three catalogues; the five refused duplicate uploads left audit rows only, staging objects were removed) |
| | Rate limit N / N+1 | N/A (no new rate limit; registry writes are Superadmin-only) |
| Post-deploy | Production URL checks | N/A (not deployed; Vercel needs Director approval, M-4) |
| Learning | `corrections/SPRINT_02_LESSONS.md` | PASS |

Open items for the Director (unchanged from Sprint 01):
1. Supabase → Authentication → Passwords: enable **leaked password protection** (advisor WARN).
2. Sentry decision (E-8), still deferred.

COMMANDER COMPLIANCE — Sprint 02
──────────────────────────────────
Rules followed without reminder:        26/29 (M-2, M-3, M-4, M-5, M-7, M-9, M-10, M-13, M-14, M-15, M-18, M-23, E-1, E-2, E-3, E-4, E-5, E-6, E-9, E-10, E-11, E-13, A-3, A-4, A-7, A-8)
Rules violated, caught by ACA:          3 (E-5 error UX: eternal splash on server error, found by the DONE check; P-14 grid overflow on screenshot; E-11/i18n date format for `bs`)
Rules violated, caught by Director:     1 (dev indicator looked like an app defect; not a Commander rule, a review-environment issue)
Rules that slowed work or felt wrong:   none
New rules suggested by this sprint:     see corrections/SPRINT_02_LESSONS.md (Commander Improvement Candidates, 3)

HANDOFF NOTE — Sprint 02
Completed: canon registry end to end. Migration 006 (private bucket, append-only version history, dependency map, three registry functions as the only write paths); `/app/kanon` (upload new document or version, activate, reject, restore, archive with reasons, history, derived-record counts, signed audited downloads) in bs/de/en; verified direct upload; failed-write auditing for canon and accounts; `npm run canon:seed` with the three catalogues active (AMB-02, live); `/app` error boundary and loading state; splash fail-safes; P-13 and P-14 rules with checks; dev indicator hidden.
Not completed: nothing from the sprint scope.
Open risks: staging objects of abandoned uploads accumulate in `staging/` (private, unreferenced) until a clean-up job exists; the CSP e2e for the upload path is meaningful only where `NEXT_PUBLIC_SUPABASE_URL` is set (unit test covers the builder).
Technical debt: staging clean-up (Sprint 03, ingestion jobs); shadcn/ui deviation (PDL-010); `subject_teacher` bundles wait for subjects (AMB-16, Sprint 04); Sentry deferred.
Lessons captured: 11 entries in corrections/SPRINT_02_LESSONS.md.
Next sprint: Sprint 03 — Ingestion pipeline: TypeScript extractor and parser profiles per catalogue, ingestion job per active version with a report, reproducing the Sprint 00 golden outputs (Math 200, B/H/S 200 + 20, German 200) with identical IDs and keys; staging clean-up; nothing becomes trusted without the semantic review of Sprint 04.
