# schema-audit.md

Supabase project: `dezevstfmfliyasdeflj` (IDSS-EGE-EKSTERNA, eu-central-1).

| Migration | Tables / objects | RLS | Applied to Supabase | Verified |
|---|---|---|---|---|
| 001_identity | profiles, capabilities, role_capabilities, capability_bundles, bundle_capabilities, profile_bundles, persons, school_years, cohorts, enrolments; seed 16 capabilities, 4 bundles | on, read-only policies, no client writes | 2026-09-27 (version 20260927121421) | local `npm run test:db` + live SQL |
| 002_canon_registry | canonical_document_types (7 seeded), canonical_documents, canonical_document_versions, canon_generation | on; students see active versions only | 2026-09-27 (20260927121430) | idem |
| 003_audit | audit_logs, security_events (append-only triggers) | on; `audit.view` only | 2026-09-27 (20260927121435) | idem |
| 004_private_auth_helpers | `private` schema; has_capability() and current_account_role() moved there; trigger search_path pinned | — | 2026-09-27 (20260927121529) | Supabase security advisor: 0 lints; live: anon sees 0 rows in every table, no usage on `private`, 0 SECURITY DEFINER functions in `public` |
| 005_rls_performance | merged own/staff SELECT policies (one per table), `(select auth.uid())`, 10 FK indexes | unchanged semantics | 2026-09-27 | local `npm run test:db` 33/33; live SQL (superadmin, forged uid, anon); performance advisor: only INFO "unused index" on new indexes |
| 006_canon_lifecycle | storage bucket `canon-documents` (private, PDF, 50 MB), canonical_version_events (append-only), canonical_dependencies; register_canon_version, activate_canon_version, set_canon_version_status (SECURITY INVOKER, service_role only); private.actor_has_capability | on; history and dependency map readable with canon.publish or canon.review | 2026-09-27 | local `npm run test:db` 63/63; live grants: anon/authenticated cannot execute; security advisor: only the known Auth WARN; performance advisor: INFO only |
| 007_ingestion | canonical_ingestion_jobs, ingested_records (both append-only, records always `untrusted_pending_review`); record_ingestion_job (SECURITY INVOKER, service_role only; writes job, records, dependency map and audit in one transaction) | on; readable with canon.publish or canon.review | 2026-09-27 | local `npm run test:db` (20 new assertions); live: grants verified, security advisor only the known Auth WARN; live rollback check with real records (3 records, 3 dependencies, 1 audit row, all rolled back, 0 left) |
