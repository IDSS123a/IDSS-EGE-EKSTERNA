# schema-audit.md

| Migration | Tables | RLS | Applied to Supabase | Verified |
|---|---|---|---|---|
| 001_identity | profiles, capabilities, role_capabilities, capability_bundles, bundle_capabilities, profile_bundles, persons, school_years, cohorts, enrolments | on, read-only policies, no client writes | pending (connector access) | local PG16 + stub, `npm run test:db` |
| 002_canon_registry | canonical_document_types, canonical_documents, canonical_document_versions, canon_generation | on; students see active versions only | pending | idem |
| 003_audit | audit_logs, security_events (append-only triggers) | on; `audit.view` only | pending | idem |
