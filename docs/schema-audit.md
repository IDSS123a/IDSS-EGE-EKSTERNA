# schema-audit.md

Supabase project: `dezevstfmfliyasdeflj` (IDSS-EGE-EKSTERNA, eu-central-1).

| Migration | Tables / objects | RLS | Applied to Supabase | Verified |
|---|---|---|---|---|
| 001_identity | profiles, capabilities, role_capabilities, capability_bundles, bundle_capabilities, profile_bundles, persons, school_years, cohorts, enrolments; seed 16 capabilities, 4 bundles | on, read-only policies, no client writes | 2026-09-27 (version 20260927121421) | local `npm run test:db` + live SQL |
| 002_canon_registry | canonical_document_types (7 seeded), canonical_documents, canonical_document_versions, canon_generation | on; students see active versions only | 2026-09-27 (20260927121430) | idem |
| 003_audit | audit_logs, security_events (append-only triggers) | on; `audit.view` only | 2026-09-27 (20260927121435) | idem |
| 004_private_auth_helpers | `private` schema; has_capability() and current_account_role() moved there; trigger search_path pinned | — | 2026-09-27 (20260927121529) | Supabase security advisor: 0 lints; live: anon sees 0 rows in every table, no usage on `private`, 0 SECURITY DEFINER functions in `public` |
| 005_rls_performance | merged own/staff SELECT policies (one per table), `(select auth.uid())`, 10 FK indexes | unchanged semantics | 2026-09-27 | local `npm run test:db` 33/33; live SQL (superadmin, forged uid, anon); performance advisor: only INFO "unused index" on new indexes |
