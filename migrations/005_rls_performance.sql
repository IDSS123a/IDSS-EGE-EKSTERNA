-- Migration: 005_rls_performance
-- Date: 2026-09-27
-- Author: ACA (Claude Code)
-- Description: Supabase performance advisor findings after Sprint 01 (lints 0001, 0003, 0006):
--   * evaluate auth.uid() once per statement via (select auth.uid()) instead of per row;
--   * merge "own" + "staff" SELECT policies into one permissive policy per table (same logic);
--   * index foreign keys used in joins and cascades checks.
--   No data changes; access semantics unchanged (verified by tests/db/rls.test.sql).
-- Rollback: drop the *_select policies created here, recreate the *_select_own / *_select_staff /
--   *_select_managers / *_select_active pairs from migrations 001–002, drop the indexes below.

drop policy profiles_select_own on public.profiles;
drop policy profiles_select_managers on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (
  user_id = (select auth.uid())
  or private.has_capability('accounts.view') or private.has_capability('accounts.manage')
);

drop policy profile_bundles_select_own on public.profile_bundles;
drop policy profile_bundles_select_managers on public.profile_bundles;
create policy profile_bundles_select on public.profile_bundles for select to authenticated using (
  profile_user_id = (select auth.uid()) or private.has_capability('accounts.manage')
);

drop policy persons_select_own on public.persons;
drop policy persons_select_staff on public.persons;
create policy persons_select on public.persons for select to authenticated using (
  profile_user_id = (select auth.uid())
  or private.has_capability('students.view_progress') or private.has_capability('cohorts.manage')
);

drop policy enrolments_select_own on public.enrolments;
drop policy enrolments_select_staff on public.enrolments;
create policy enrolments_select on public.enrolments for select to authenticated using (
  exists (select 1 from public.persons pe where pe.id = person_id and pe.profile_user_id = (select auth.uid()))
  or private.has_capability('students.view_progress') or private.has_capability('cohorts.manage')
);

drop policy canonical_document_versions_select_active on public.canonical_document_versions;
drop policy canonical_document_versions_select_staff on public.canonical_document_versions;
create policy canonical_document_versions_select on public.canonical_document_versions for select to authenticated using (
  (status = 'active' and private.current_account_role() is not null)
  or private.has_capability('canon.publish') or private.has_capability('canon.review')
);

create index bundle_capabilities_capability_code_idx on public.bundle_capabilities (capability_code);
create index role_capabilities_capability_code_idx on public.role_capabilities (capability_code);
create index profile_bundles_bundle_code_idx on public.profile_bundles (bundle_code);
create index profile_bundles_granted_by_idx on public.profile_bundles (granted_by);
create index enrolments_cohort_id_idx on public.enrolments (cohort_id);
create index canonical_documents_type_code_idx on public.canonical_documents (type_code);
create index canonical_document_versions_uploaded_by_idx on public.canonical_document_versions (uploaded_by);
create index canonical_document_versions_activated_by_idx on public.canonical_document_versions (activated_by);
create index canonical_document_versions_superseded_by_idx on public.canonical_document_versions (superseded_by_version_id);
create index security_events_user_id_idx on public.security_events (user_id);
