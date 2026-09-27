-- RLS and integrity tests for migrations 001–008. Any failed assertion raises and stops psql
-- (ON_ERROR_STOP), so the runner's exit code is the test result.
\set ON_ERROR_STOP on
set client_min_messages = warning;

-- Fixtures (as the migration owner, i.e. "server").
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'direktor@idss.ba'),
  ('00000000-0000-0000-0000-00000000000b', 'teacher@test.invalid'),
  ('00000000-0000-0000-0000-00000000000c', 'student-one@users.invalid'),
  ('00000000-0000-0000-0000-00000000000d', 'student-two@users.invalid'),
  ('00000000-0000-0000-0000-00000000000e', 'blocked@test.invalid');
insert into public.profiles (user_id, username, display_name, role, account_status) values
  ('00000000-0000-0000-0000-00000000000a', 'direktor@idss.ba', 'Test Superadmin', 'superadmin', 'active'),
  ('00000000-0000-0000-0000-00000000000b', 'teacher@test.invalid', 'Test Teacher', 'administrator', 'active'),
  ('00000000-0000-0000-0000-00000000000c', 'student.one', 'Test Student One', 'student', 'active'),
  ('00000000-0000-0000-0000-00000000000d', 'student.two', 'Test Student Two', 'student', 'active'),
  ('00000000-0000-0000-0000-00000000000e', 'blocked.admin', 'Test Blocked', 'superadmin', 'blocked');
-- A subject (migration 008) backed by a fixture catalogue version, for scoped grants.
insert into public.canonical_documents (id, type_code, title)
  values ('66666666-6666-6666-6666-666666666601', 'subject_catalogue', 'Fixture catalogue');
insert into public.canonical_document_versions (id, document_id, storage_path, sha256, mime_type, byte_size,
  issuing_authority, official_title, status, uploaded_by, activated_at)
  values ('77777777-7777-7777-7777-777777777701', '66666666-6666-6666-6666-666666666601', 'x/fixture.pdf', repeat('1', 64),
  'application/pdf', 1, 'Test authority', 'Fixture v1', 'active', '00000000-0000-0000-0000-00000000000a', now());
insert into public.subjects (id, code, official_name, legal_basis, source_version_id, evidence, facts_version)
  values ('11111111-1111-1111-1111-111111111111', 'mathematics', 'Matematika', 'Test', '77777777-7777-7777-7777-777777777701',
  '[{"page": 1, "quote": "Test"}]', 1);
insert into public.profile_bundles (profile_user_id, bundle_code, scope_subject_id) values
  ('00000000-0000-0000-0000-00000000000b', 'subject_teacher', '11111111-1111-1111-1111-111111111111');
insert into public.persons (id, profile_user_id) values
  ('22222222-2222-2222-2222-22222222222c', '00000000-0000-0000-0000-00000000000c'),
  ('22222222-2222-2222-2222-22222222222d', '00000000-0000-0000-0000-00000000000d');
insert into public.school_years (id, label, starts_on, ends_on, status)
  values ('33333333-3333-3333-3333-333333333333', '1970/71', '1970-09-01', '1971-06-30', 'active');
insert into public.cohorts (id, school_year_id, label)
  values ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 'IX test');
insert into public.enrolments (person_id, cohort_id) values
  ('22222222-2222-2222-2222-22222222222c', '44444444-4444-4444-4444-444444444444'),
  ('22222222-2222-2222-2222-22222222222d', '44444444-4444-4444-4444-444444444444');

create function pg_temp.assert(condition boolean, label text) returns void language plpgsql as $$
begin
  if condition is not true then raise exception 'FAIL: %', label; end if;
  raise notice 'ok - %', label;
end $$;
set client_min_messages = notice;

-- 1. Anonymous (no/garbage token): sees nothing.
set role anon;
select pg_temp.assert((select count(*) from public.profiles) = 0, 'anon reads no profiles');
select pg_temp.assert((select count(*) from public.enrolments) = 0, 'anon reads no enrolments');
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '99999999-9999-9999-9999-999999999999', false);
select pg_temp.assert((select count(*) from public.profiles) = 0, 'forged token for unknown user reads no profiles');
select pg_temp.assert(private.has_capability('accounts.manage') = false, 'forged token has no capability');

-- 2. Student: own rows only, no escalation.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
select pg_temp.assert((select count(*) from public.profiles) = 1, 'student sees only own profile');
select pg_temp.assert((select count(*) from public.enrolments) = 1, 'student sees only own enrolment');
select pg_temp.assert((select count(*) from public.persons where profile_user_id <> auth.uid()) = 0, 'student cannot see other persons');
select pg_temp.assert(private.has_capability('practice.participate'), 'student may practise');
select pg_temp.assert(not private.has_capability('students.view_progress'), 'student cannot view others'' progress');
update public.profiles set role = 'superadmin' where user_id = auth.uid();
select pg_temp.assert((select role from public.profiles where user_id = auth.uid()) = 'student', 'self-escalation of role has no effect');
update public.profiles set account_status = 'active' where user_id = '00000000-0000-0000-0000-00000000000e';
do $$ begin
  insert into public.profile_bundles (profile_user_id, bundle_code) values (auth.uid(), 'pedagogue');
  raise exception 'FAIL: student granted itself a bundle';
exception when insufficient_privilege then raise notice 'ok - student cannot grant itself a bundle';
end $$;

reset role;
select pg_temp.assert((select account_status from public.profiles where user_id = '00000000-0000-0000-0000-00000000000e') = 'blocked',
  'student cannot unblock another account');
set role authenticated;

-- 3. Subject teacher: scoped capabilities.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select pg_temp.assert(private.has_capability('canon.review', '11111111-1111-1111-1111-111111111111'), 'teacher reviews own subject');
select pg_temp.assert(not private.has_capability('canon.review', '55555555-5555-5555-5555-555555555555'), 'teacher cannot review another subject');
select pg_temp.assert(not private.has_capability('support_notes.read_write'), 'subject teacher has no support-note access');
select pg_temp.assert(not private.has_capability('canon.publish'), 'teacher cannot publish canon');
select pg_temp.assert((select count(*) from public.enrolments) = 2, 'teacher with students.view_progress sees enrolments');

-- 4. Superadmin, and a blocked superadmin.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select pg_temp.assert(private.has_capability('canon.publish'), 'superadmin publishes canon');
select pg_temp.assert(not private.has_capability('support_notes.read_write'), 'superadmin support-note access denied by default');
select pg_temp.assert((select count(*) from public.profiles) = 5, 'superadmin sees all profiles');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000e', false);
select pg_temp.assert(not private.has_capability('accounts.manage'), 'blocked account loses every capability');
select pg_temp.assert((select count(*) from public.profiles) = 1, 'blocked account sees only itself');
reset role;

-- 5. Canon registry: one active version per document.
insert into public.canonical_documents (id, type_code, title)
  values ('66666666-6666-6666-6666-666666666666', 'subject_catalogue', 'Test catalogue');
insert into public.canonical_document_versions (document_id, storage_path, sha256, mime_type, byte_size,
  issuing_authority, official_title, status, uploaded_by, activated_at)
  values ('66666666-6666-6666-6666-666666666666', 'canon-sources/a.pdf', repeat('a', 64), 'application/pdf', 1,
  'Test authority', 'Test v1', 'active', '00000000-0000-0000-0000-00000000000a', now());
do $$ begin
  insert into public.canonical_document_versions (document_id, storage_path, sha256, mime_type, byte_size,
    issuing_authority, official_title, status, uploaded_by, activated_at)
    values ('66666666-6666-6666-6666-666666666666', 'canon-sources/b.pdf', repeat('b', 64), 'application/pdf', 1,
    'Test authority', 'Test v2', 'active', '00000000-0000-0000-0000-00000000000a', now());
  raise exception 'FAIL: two active versions accepted';
exception when unique_violation then raise notice 'ok - second active version rejected';
end $$;
insert into public.canonical_document_versions (document_id, storage_path, sha256, mime_type, byte_size,
  issuing_authority, official_title, status, uploaded_by)
  values ('66666666-6666-6666-6666-666666666666', 'canon-sources/c.pdf', repeat('c', 64), 'application/pdf', 1,
  'Test authority', 'Test draft', 'validation_required', '00000000-0000-0000-0000-00000000000a');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
select pg_temp.assert((select count(*) from public.canonical_document_versions where document_id = '66666666-6666-6666-6666-666666666666') = 1, 'student sees only the active version');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select pg_temp.assert((select count(*) from public.canonical_document_versions where document_id = '66666666-6666-6666-6666-666666666666') = 2, 'superadmin sees full version history');
reset role;

-- 6. Audit log is append-only, even for the service role.
insert into public.audit_logs (actor_user_id, action, entity_type) values ('00000000-0000-0000-0000-00000000000a', 'account.created', 'profile');
set role service_role;
do $$ begin
  update public.audit_logs set action = 'account.deleted';
  raise exception 'FAIL: audit row updated';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'ok - audit update rejected';
end $$;
do $$ begin
  delete from public.audit_logs;
  raise exception 'FAIL: audit row deleted';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'ok - audit delete rejected';
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
select pg_temp.assert((select count(*) from public.audit_logs) = 0, 'student cannot read audit log');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select pg_temp.assert((select count(*) from public.audit_logs) = 1, 'superadmin reads audit log');
reset role;

-- 7. Authorization helpers are not callable anonymously and not in the API-exposed schema.
set role anon;
do $$ begin
  perform private.has_capability('accounts.manage');
  raise exception 'FAIL: anon executed has_capability';
exception when insufficient_privilege then raise notice 'ok - anon cannot execute authorization helpers';
end $$;
reset role;
select pg_temp.assert(not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef), 'no SECURITY DEFINER function in public schema');

-- 8. Every public table has RLS enabled.
select pg_temp.assert(not exists (
  select 1 from pg_tables where schemaname = 'public' and not rowsecurity), 'RLS enabled on every public table');

-- 9. Canon lifecycle (migration 006): the only write paths, called by the server (service role).
reset role;
set role service_role;
create temp table t_ids (name text primary key, id uuid);
insert into t_ids values
  ('d', '77777777-7777-7777-7777-77777777777d'), ('e', '77777777-7777-7777-7777-77777777777e'),
  ('f', '77777777-7777-7777-7777-77777777777f');
create function pg_temp.reg(actor uuid, doc uuid, vid uuid, sha text) returns jsonb language sql as $$
  select public.register_canon_version(actor, doc, 'subject_catalogue', 'Lifecycle test', '{}'::jsonb, vid,
    'x/' || sha || '.pdf', sha, 'application/pdf', 10, 'Test authority', 'Test title', null, null, null, null, null)
$$;
create function pg_temp.expect_error(statement text, expected text, label text) returns void language plpgsql as $$
begin
  execute statement;
  raise exception 'FAIL: % (no error)', label;
exception when others then
  if sqlerrm like 'FAIL%' then raise; end if;
  if sqlerrm <> expected then raise exception 'FAIL: % (got %)', label, sqlerrm; end if;
  raise notice 'ok - %', label;
end $$;

select pg_temp.expect_error($$select pg_temp.reg('00000000-0000-0000-0000-00000000000b', null, gen_random_uuid(), repeat('9', 64))$$,
  'FORBIDDEN', 'canon.review alone cannot upload');
select pg_temp.expect_error($$select pg_temp.reg('00000000-0000-0000-0000-00000000000c', null, gen_random_uuid(), repeat('9', 64))$$,
  'FORBIDDEN', 'student cannot upload');
select pg_temp.expect_error($$select pg_temp.reg('00000000-0000-0000-0000-00000000000e', null, gen_random_uuid(), repeat('9', 64))$$,
  'FORBIDDEN', 'blocked superadmin cannot upload');

create temp table t_doc as
  select (pg_temp.reg('00000000-0000-0000-0000-00000000000a', null, (select id from t_ids where name = 'd'), repeat('d', 64)) ->> 'document_id')::uuid as id;
select pg_temp.assert((select status from public.canonical_document_versions where sha256 = repeat('d', 64)) = 'validation_required',
  'upload lands in validation_required');
select pg_temp.assert(exists (select 1 from public.canonical_version_events e join t_ids i on i.id = e.version_id and i.name = 'd' where e.event = 'uploaded'),
  'upload writes a history event');
select pg_temp.assert(exists (select 1 from public.audit_logs where action = 'canon.version_uploaded'), 'upload writes an audit row');
select pg_temp.expect_error($$select pg_temp.reg('00000000-0000-0000-0000-00000000000a', null, gen_random_uuid(), repeat('d', 64))$$,
  'DUPLICATE_FILE', 'same file (SHA-256) cannot be uploaded twice');

create temp table t_gen as select generation as g0 from public.canon_generation;
select public.activate_canon_version('00000000-0000-0000-0000-00000000000a', (select id from t_ids where name = 'd'), null, null);
select pg_temp.assert((select status from public.canonical_document_versions where sha256 = repeat('d', 64)) = 'active', 'version d activated');
select pg_temp.assert((select generation from public.canon_generation) = (select g0 + 1 from t_gen), 'activation bumps canon_generation');
select pg_temp.expect_error($$select public.activate_canon_version('00000000-0000-0000-0000-00000000000a', '77777777-7777-7777-7777-77777777777d', null, null)$$,
  'INVALID_TRANSITION', 'active version cannot be activated again');
select pg_temp.expect_error($$select public.activate_canon_version('00000000-0000-0000-0000-00000000000b', '77777777-7777-7777-7777-77777777777d', null, null)$$,
  'FORBIDDEN', 'canon.review alone cannot activate');

select pg_temp.reg('00000000-0000-0000-0000-00000000000a', (select id from t_doc), (select id from t_ids where name = 'e'), repeat('e', 64));
select public.activate_canon_version('00000000-0000-0000-0000-00000000000a', (select id from t_ids where name = 'e'), null, null);
select pg_temp.assert((select status from public.canonical_document_versions where sha256 = repeat('d', 64)) = 'superseded'
  and (select superseded_by_version_id from public.canonical_document_versions where sha256 = repeat('d', 64)) = (select id from t_ids where name = 'e'),
  'activating e supersedes d and links it');
select pg_temp.assert((select count(*) from public.canonical_document_versions where document_id = (select id from t_doc) and status = 'active') = 1,
  'exactly one active version after supersede');

insert into public.canonical_dependencies (source_version_id, dependent_table, dependent_id)
  values ((select id from t_ids where name = 'e'), 'question_versions', 'q-1');
select pg_temp.expect_error($$select public.activate_canon_version('00000000-0000-0000-0000-00000000000a', '77777777-7777-7777-7777-77777777777d', ' ', null)$$,
  'REASON_REQUIRED', 'rollback needs a reason');
select public.activate_canon_version('00000000-0000-0000-0000-00000000000a', (select id from t_ids where name = 'd'), 'Test rollback', null);
select pg_temp.assert((select status from public.canonical_document_versions where sha256 = repeat('d', 64)) = 'active'
  and (select status from public.canonical_document_versions where sha256 = repeat('e', 64)) = 'superseded', 'rollback re-activates d and supersedes e');
select pg_temp.assert((select state from public.canonical_dependencies where dependent_id = 'q-1') = 'stale', 'dependents of the superseded version become stale');
select pg_temp.assert(exists (select 1 from public.canonical_version_events where event = 'rolled_back' and reason = 'Test rollback'), 'rollback recorded with reason');
select pg_temp.assert(exists (select 1 from public.audit_logs where action = 'canon.version_rolled_back'), 'rollback audited');

select pg_temp.expect_error($$select public.set_canon_version_status('00000000-0000-0000-0000-00000000000a', '77777777-7777-7777-7777-77777777777d', 'archived', 'x', null)$$,
  'INVALID_TRANSITION', 'active version cannot be archived');
select pg_temp.reg('00000000-0000-0000-0000-00000000000a', (select id from t_doc), (select id from t_ids where name = 'f'), repeat('f', 64));
select pg_temp.expect_error($$select public.set_canon_version_status('00000000-0000-0000-0000-00000000000a', '77777777-7777-7777-7777-77777777777f', 'rejected', '', null)$$,
  'REASON_REQUIRED', 'reject needs a reason');
select public.set_canon_version_status('00000000-0000-0000-0000-00000000000a', (select id from t_ids where name = 'f'), 'rejected', 'Wrong file', null);
select pg_temp.expect_error($$select public.activate_canon_version('00000000-0000-0000-0000-00000000000a', '77777777-7777-7777-7777-77777777777f', null, null)$$,
  'INVALID_TRANSITION', 'rejected version cannot be activated');
select public.set_canon_version_status('00000000-0000-0000-0000-00000000000a', (select id from t_ids where name = 'e'), 'archived', 'Old draft', null);
select pg_temp.assert((select status from public.canonical_document_versions where sha256 = repeat('e', 64)) = 'archived', 'superseded version archived');
select pg_temp.assert((select count(*) from public.canonical_document_versions where document_id = (select id from t_doc)) = 3, 'nothing deleted: all three versions remain');
do $$ begin
  delete from public.canonical_version_events;
  raise exception 'FAIL: history event deleted';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'ok - lifecycle history is append-only';
end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
do $$ begin
  perform public.activate_canon_version('00000000-0000-0000-0000-00000000000a', '77777777-7777-7777-7777-77777777777e', 'x', null);
  raise exception 'FAIL: authenticated executed activate_canon_version';
exception when insufficient_privilege then raise notice 'ok - signed-in users cannot call lifecycle functions directly';
end $$;
select pg_temp.assert((select count(*) from public.canonical_version_events) > 0, 'superadmin reads lifecycle history');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select pg_temp.assert((select count(*) from public.canonical_version_events) > 0, 'canon.review reads lifecycle history');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
select pg_temp.assert((select count(*) from public.canonical_version_events) = 0, 'student cannot read lifecycle history');
select pg_temp.assert((select count(*) from public.canonical_dependencies) = 0, 'student cannot read dependency map');
reset role;
set role anon;
do $$ begin
  perform public.register_canon_version(null, null, 'x', 'x', null, null, 'x', repeat('1', 64), 'x', 1, 'x', 'x', null, null, null, null, null);
  raise exception 'FAIL: anon executed register_canon_version';
exception when insufficient_privilege then raise notice 'ok - anon cannot call lifecycle functions';
end $$;
reset role;
select pg_temp.assert((select count(*) from storage.buckets where id = 'canon-documents' and not public) = 1, 'canon bucket exists and is private');

-- 10. Ingestion jobs (migration 007): one transaction, untrusted records, dependency map, append-only.
set role service_role;
create function pg_temp.job(state text, failure text) returns jsonb language sql as $$
  select jsonb_build_object('state', state, 'profile_code', 'subject_catalogue.test', 'profile_version', 1,
    'extractor_version', '1.0.0', 'page_count', 3, 'counts', '{"units": 2}'::jsonb, 'report', '{}'::jsonb,
    'failure_code', failure, 'started_at', now())
$$;
create temp table t_records as select jsonb_build_array(
  jsonb_build_object('record_key', 'MAT-5.1.1', 'record_kind', 'official_catalogue_question', 'structural_status', 'passed', 'record', '{"id": "MAT-5.1.1"}'::jsonb),
  jsonb_build_object('record_key', 'MAT-5.1.2', 'record_kind', 'official_catalogue_question', 'structural_status', 'passed_with_flags', 'record', '{"id": "MAT-5.1.2"}'::jsonb)) as value;

select pg_temp.expect_error($$select public.record_ingestion_job('00000000-0000-0000-0000-00000000000b', '77777777-7777-7777-7777-77777777777d', pg_temp.job('succeeded', null), (select value from t_records), null)$$,
  'FORBIDDEN', 'canon.review alone cannot record an ingestion job');
select pg_temp.expect_error($$select public.record_ingestion_job('00000000-0000-0000-0000-00000000000a', '77777777-7777-7777-7777-77777777777f', pg_temp.job('succeeded', null), (select value from t_records), null)$$,
  'INVALID_TRANSITION', 'a rejected version is never ingested');
select pg_temp.expect_error($$select public.record_ingestion_job('00000000-0000-0000-0000-00000000000a', '77777777-7777-7777-7777-77777777777d', pg_temp.job('failed', 'NO_PROFILE'), (select value from t_records), null)$$,
  'VALIDATION', 'a failed job carries no records');

create temp table t_job as select public.record_ingestion_job('00000000-0000-0000-0000-00000000000a', '77777777-7777-7777-7777-77777777777d',
  pg_temp.job('succeeded', null), (select value from t_records), null) as id;
select pg_temp.assert((select count(*) from public.ingested_records where job_id = (select id from t_job)) = 2, 'job stores its records');
select pg_temp.assert((select array_agg(record_key order by ordinal) from public.ingested_records where job_id = (select id from t_job)) = array['MAT-5.1.1', 'MAT-5.1.2'], 'records keep source order');
select pg_temp.assert((select bool_and(trust_status = 'untrusted_pending_review') from public.ingested_records), 'ingested records are untrusted');
select pg_temp.assert((select count(*) from public.canonical_dependencies where dependent_table = 'ingested_records' and state = 'current') = 2, 'records are registered in the dependency map');
select pg_temp.assert(exists (select 1 from public.audit_logs where action = 'canon.ingestion_succeeded'), 'ingestion audited');
select public.record_ingestion_job('00000000-0000-0000-0000-00000000000a', '77777777-7777-7777-7777-77777777777d', pg_temp.job('failed', 'NO_PROFILE'), '[]'::jsonb, null);
select pg_temp.assert((select count(*) from public.canonical_ingestion_jobs where state = 'failed' and failure_code = 'NO_PROFILE') = 1, 'failed job recorded with its reason');
do $$ begin
  update public.ingested_records set structural_status = 'passed';
  raise exception 'FAIL: ingested record changed';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'ok - ingested records are append-only';
end $$;
do $$ begin
  delete from public.canonical_ingestion_jobs;
  raise exception 'FAIL: ingestion job deleted';
exception when raise_exception or foreign_key_violation then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'ok - ingestion jobs cannot be deleted';
end $$;

-- Superseding the source version makes the derived records stale.
select pg_temp.reg('00000000-0000-0000-0000-00000000000a', (select id from t_doc), '77777777-7777-7777-7777-777777777770', repeat('0', 64));
select public.activate_canon_version('00000000-0000-0000-0000-00000000000a', '77777777-7777-7777-7777-777777777770', null, null);
select pg_temp.assert((select count(*) from public.canonical_dependencies where dependent_table = 'ingested_records' and state = 'stale') = 2, 'superseding the version marks its records stale');
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select pg_temp.assert((select count(*) from public.ingested_records) = 2, 'canon.review reads ingested records');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
select pg_temp.assert((select count(*) from public.ingested_records) = 0 and (select count(*) from public.canonical_ingestion_jobs) = 0, 'students never see ingestion data');
do $$ begin
  perform public.record_ingestion_job('00000000-0000-0000-0000-00000000000a', '77777777-7777-7777-7777-77777777777d', '{}'::jsonb, '[]'::jsonb, null);
  raise exception 'FAIL: authenticated executed record_ingestion_job';
exception when insufficient_privilege then raise notice 'ok - signed-in users cannot record ingestion jobs directly';
end $$;
reset role;
select pg_temp.assert(not exists (select 1 from pg_tables where schemaname = 'public' and not rowsecurity), 'RLS still enabled on every public table');

-- 11. Review and knowledge (migration 008): facts with provenance, scoped review, trusted copies, key revisions.
set role service_role;
create function pg_temp.facts(sha text, code text) returns jsonb language sql as $$
  select jsonb_build_object('sha256', sha, 'facts_version', 1,
    'subject', jsonb_build_object('code', code, 'official_name', 'Njemački jezik', 'legal_basis', 'Test basis',
      'evidence', '[{"page": 4, "quote": "Test quote"}]'::jsonb),
    'rules', '[{"code": "exam.duration_minutes", "value": {"minutes": 60}, "evidence": [{"page": 8, "quote": "traje 60 minuta"}]},
               {"code": "exam.total_points", "value": {"points": 10}, "evidence": [{"page": 8, "quote": "10 bodova"}]}]'::jsonb)
$$;
select pg_temp.expect_error($$select public.load_canonical_facts('00000000-0000-0000-0000-00000000000b', '77777777-7777-7777-7777-777777777770', pg_temp.facts(repeat('0', 64), 'german'), null)$$,
  'FORBIDDEN', 'a subject teacher cannot load canonical facts');
select pg_temp.expect_error($$select public.load_canonical_facts('00000000-0000-0000-0000-00000000000a', '77777777-7777-7777-7777-777777777770', pg_temp.facts(repeat('9', 64), 'german'), null)$$,
  'INTEGRITY', 'facts bound to another edition are refused');
select pg_temp.expect_error($$select public.load_canonical_facts('00000000-0000-0000-0000-00000000000a', '77777777-7777-7777-7777-77777777777f', pg_temp.facts(repeat('f', 64), 'german'), null)$$,
  'INVALID_TRANSITION', 'facts are never loaded from a rejected version');
create temp table t_german as select public.load_canonical_facts('00000000-0000-0000-0000-00000000000a', '77777777-7777-7777-7777-777777777770',
  pg_temp.facts(repeat('0', 64), 'german'), null) as id;
select pg_temp.assert((select code from public.subjects where id = (select id from t_german)) = 'german', 'loading facts creates the subject');
select pg_temp.assert((select count(*) from public.canonical_rules where subject_id = (select id from t_german)) = 2, 'loading facts stores the rules with evidence');
select pg_temp.assert((select scope_subject_id from public.canonical_documents where id = (select id from t_doc)) = (select id from t_german), 'the catalogue document is scoped to its subject');
select pg_temp.assert((select count(*) from public.canonical_dependencies where dependent_table in ('canonical_rules', 'subjects')) = 3, 'rules and subject are in the dependency map');
select pg_temp.assert(exists (select 1 from public.audit_logs where action = 'canon.facts_loaded'), 'facts load audited');
select pg_temp.expect_error($$select public.load_canonical_facts('00000000-0000-0000-0000-00000000000a', '77777777-7777-7777-7777-777777777770', pg_temp.facts(repeat('0', 64), 'german'), null)$$,
  'ALREADY_LOADED', 'facts of one edition are loaded once');
do $$ begin
  insert into public.profile_bundles (profile_user_id, bundle_code) values ('00000000-0000-0000-0000-00000000000d', 'subject_teacher');
  raise exception 'FAIL: unscoped subject teacher granted';
exception when check_violation then raise notice 'ok - a subject teacher grant always names its subject';
end $$;

-- Records on the fixture Math version (subject 1111, the teacher's scope).
create function pg_temp.rec(key text, subject text, status text, logic jsonb) returns jsonb language sql as $$
  select jsonb_build_object('record_key', key, 'record_kind', 'official_catalogue_question', 'structural_status', status,
    'record', jsonb_build_object('id', key, 'subject', subject,
      'source', '{"original_number": "5.1.1", "section_path": ["5.1 Brojevni izrazi", "osnovni nivo"], "pages": [23], "regions": [{"page": 23, "bbox": [72, 194.9, 540, 302.9]}]}'::jsonb,
      'syntax', '{"raw_text": "5.1.1. Test?", "stem_text": "5.1.1. Test?", "options": [{"label": "a", "text": "0"}], "emphasis_spans": [], "has_figure_reference": false, "notation_fidelity": "text_layer_ok"}'::jsonb,
      'semantics', '{"area": "Brojevni izrazi", "catalogue_level": "osnovni nivo"}'::jsonb,
      'logic', logic))
$$;
create temp table t_job1 as select public.record_ingestion_job('00000000-0000-0000-0000-00000000000a', '77777777-7777-7777-7777-777777777701',
  pg_temp.job('succeeded', null), jsonb_build_array(
    pg_temp.rec('MAT-5.1.1', 'mathematics', 'passed', '{"task_type": "multiple_choice_single_answer", "answer_key_raw": "c)", "answer_key_source": "catalogue §6"}'),
    pg_temp.rec('MAT-5.1.2', 'mathematics', 'failed', '{"task_type": "multiple_choice_single_answer", "answer_key_raw": "d)"}'),
    pg_temp.rec('MAT-5.1.3', 'mathematics', 'passed', '{"task_type": "multiple_choice_single_answer", "answer_key_raw": "a)"}'),
    pg_temp.rec('DEU-4.2.1', 'german', 'passed', '{"task_type": "true_false", "answer_key_raw": "1 r\n2 f", "scored_items": [{"item_number": 1, "raw_text": "A", "answer_key_raw": "r"}, {"item_number": 2, "raw_text": "B", "answer_key_raw": "f"}]}'),
    pg_temp.rec('BHS-FON.1', 'bhs_language_literature', 'passed', '{"task_type": "completion", "answer_key_raw": "fonetika"}')), null) as id;
create function pg_temp.rid(key text) returns bigint language sql as $$
  select id from public.ingested_records where job_id = (select id from t_job1) and record_key = key
$$;

select pg_temp.expect_error($$select public.decide_record_review('00000000-0000-0000-0000-00000000000b', pg_temp.rid('MAT-5.1.1'), 'returned', null, '  ', null)$$,
  'VALIDATION', 'returning a record needs a reason');
select pg_temp.expect_error($$select public.decide_record_review('00000000-0000-0000-0000-00000000000b', pg_temp.rid('MAT-5.1.1'), 'accepted', null, null, null)$$,
  'VALIDATION', 'accepting a record needs a confirmed task type');
select pg_temp.expect_error($$select public.decide_record_review('00000000-0000-0000-0000-00000000000b', pg_temp.rid('DEU-4.2.1'), 'accepted', 'true_false', null, null)$$,
  'FORBIDDEN', 'a teacher cannot review another subject');
select pg_temp.expect_error($$select public.decide_record_review('00000000-0000-0000-0000-00000000000c', pg_temp.rid('MAT-5.1.1'), 'accepted', 'multiple_choice_single_answer', null, null)$$,
  'FORBIDDEN', 'a student cannot review');
select pg_temp.expect_error($$select public.decide_record_review('00000000-0000-0000-0000-00000000000a', pg_temp.rid('BHS-FON.1'), 'accepted', 'completion', null, null)$$,
  'SUBJECT_MISSING', 'records of a subject without loaded facts are not reviewed');
select pg_temp.expect_error($$select public.decide_record_review('00000000-0000-0000-0000-00000000000b', pg_temp.rid('MAT-5.1.2'), 'accepted', 'multiple_choice_single_answer', null, null)$$,
  'NOT_ACCEPTABLE', 'a structurally failed record cannot be accepted');
select public.decide_record_review('00000000-0000-0000-0000-00000000000b', pg_temp.rid('MAT-5.1.1'), 'returned', null, 'Opcija d) nedostaje', null);
select pg_temp.assert((select count(*) from public.question_versions) = 0, 'a returned record creates no trusted copy');
select public.decide_record_review('00000000-0000-0000-0000-00000000000b', pg_temp.rid('MAT-5.1.1'), 'accepted', 'multiple_choice_single_answer', null, null);
select pg_temp.assert((select count(*) from public.question_versions where record_id = pg_temp.rid('MAT-5.1.1')) = 1, 'acceptance creates exactly one trusted question version');
select pg_temp.assert((select printed_answer from public.answer_keys k join public.question_versions v on v.id = k.question_version_id where v.record_id = pg_temp.rid('MAT-5.1.1')) = 'c)', 'the printed key is stored as printed');
select pg_temp.assert((select a.label from public.subject_areas a join public.question_versions v on v.area_id = a.id where v.record_id = pg_temp.rid('MAT-5.1.1')) = 'Brojevni izrazi', 'the catalogue area becomes a subject area');
select pg_temp.assert(exists (select 1 from public.canonical_dependencies where dependent_table = 'question_versions'), 'trusted copies are in the dependency map');
select pg_temp.assert(exists (select 1 from public.audit_logs where action = 'review.record_accepted') and exists (select 1 from public.audit_logs where action = 'review.record_returned'), 'review decisions audited');
select pg_temp.expect_error($$select public.decide_record_review('00000000-0000-0000-0000-00000000000b', pg_temp.rid('MAT-5.1.1'), 'returned', null, 'again', null)$$,
  'ALREADY_ACCEPTED', 'an accepted record takes no further decision');
select public.decide_record_review('00000000-0000-0000-0000-00000000000a', pg_temp.rid('DEU-4.2.1'), 'accepted', 'true_false', null, null);
select pg_temp.assert((select count(*) from public.answer_keys k join public.question_versions v on v.id = k.question_version_id where v.record_id = pg_temp.rid('DEU-4.2.1')) = 2, 'German keys are stored per scored item');
select pg_temp.assert((select bool_and(not (item ? 'answer_key_raw')) from public.question_versions v, jsonb_array_elements(v.scored_items) item), 'scored items carry no keys');

-- A newer ingestion job makes the older job's records stale for review.
create temp table t_job2 as select public.record_ingestion_job('00000000-0000-0000-0000-00000000000a', '77777777-7777-7777-7777-777777777701',
  pg_temp.job('succeeded', null), jsonb_build_array(pg_temp.rec('MAT-5.1.1', 'mathematics', 'passed', '{"task_type": "multiple_choice_single_answer", "answer_key_raw": "c)"}')), null) as id;
select pg_temp.expect_error($$select public.decide_record_review('00000000-0000-0000-0000-00000000000b', pg_temp.rid('MAT-5.1.3'), 'accepted', 'multiple_choice_single_answer', null, null)$$,
  'STALE_RECORD', 'only records of the latest job are reviewed');
select pg_temp.expect_error($$select public.decide_record_review('00000000-0000-0000-0000-00000000000b', (select id from public.ingested_records where job_id = (select id from t_job2)), 'accepted', 'multiple_choice_single_answer', null, null)$$,
  'ALREADY_ACCEPTED', 'a question accepted from an earlier job is not accepted twice');

-- Answer-key revisions never change the printed key.
create temp table t_key as select k.id, k.subject_id from public.answer_keys k join public.question_versions v on v.id = k.question_version_id where v.record_id = pg_temp.rid('MAT-5.1.1');
create temp table t_de_key as select k.id from public.answer_keys k join public.question_versions v on v.id = k.question_version_id where v.record_id = pg_temp.rid('DEU-4.2.1') and k.item_number = 1;
select pg_temp.expect_error($$select public.propose_answer_key_revision('00000000-0000-0000-0000-00000000000b', (select id from t_de_key), 'f', 'Test', null, null)$$,
  'FORBIDDEN', 'a teacher cannot revise keys of another subject');
select pg_temp.expect_error($$select public.propose_answer_key_revision('00000000-0000-0000-0000-00000000000b', (select id from t_key), 'b)', ' ', null, null)$$,
  'VALIDATION', 'a key revision needs a reason');
select public.propose_answer_key_revision('00000000-0000-0000-0000-00000000000b', (select id from t_key), 'b)', 'Tačan rezultat je 891', 'Rješenje: 900 - 9 = 891', null);
select pg_temp.assert((select printed_answer from public.answer_keys where id = (select id from t_key)) = 'c)', 'the printed key never changes');
select pg_temp.assert((select corrected_answer from public.answer_key_revisions where answer_key_id = (select id from t_key)) = 'b)', 'the revision is stored beside it');
do $$ begin
  update public.answer_keys set printed_answer = 'x';
  raise exception 'FAIL: printed key changed';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'ok - printed keys are append-only';
end $$;
do $$ begin
  delete from public.record_reviews;
  raise exception 'FAIL: review deleted';
exception when raise_exception or foreign_key_violation then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'ok - review decisions cannot be deleted';
end $$;

-- Rule review, scoped like record review.
create temp table t_rule as select id from public.canonical_rules where subject_id = (select id from t_german) and rule_code = 'exam.duration_minutes';
select pg_temp.expect_error($$select public.decide_rule_review('00000000-0000-0000-0000-00000000000b', (select id from t_rule), 'confirmed', null, null)$$,
  'FORBIDDEN', 'a teacher cannot review rules of another subject');
select pg_temp.expect_error($$select public.decide_rule_review('00000000-0000-0000-0000-00000000000a', (select id from t_rule), 'disputed', null, null)$$,
  'VALIDATION', 'disputing a rule needs a note');
select public.decide_rule_review('00000000-0000-0000-0000-00000000000a', (select id from t_rule), 'confirmed', null, null);
select pg_temp.assert(exists (select 1 from public.audit_logs where action = 'review.rule_confirmed'), 'rule review audited');
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select pg_temp.assert((select count(*) from public.question_versions) = 1, 'a teacher reads trusted questions of own subject only');
select pg_temp.assert((select count(*) from public.canonical_rules) = 0, 'a teacher reads no rules of another subject');
select pg_temp.assert((select count(*) from public.record_reviews) = 2, 'a teacher reads review history of own subject');
select pg_temp.assert((select count(*) from public.subjects) = 2, 'subjects are visible to active accounts');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select pg_temp.assert((select count(*) from public.question_versions) = 2 and (select count(*) from public.canonical_rules) = 2, 'the superadmin reads every subject');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
select pg_temp.assert((select count(*) from public.question_versions) + (select count(*) from public.answer_keys) + (select count(*) from public.record_reviews)
  + (select count(*) from public.canonical_rules) + (select count(*) from public.answer_key_revisions) = 0, 'students read no review material yet');
do $$ begin
  perform public.decide_record_review('00000000-0000-0000-0000-00000000000b', 1, 'accepted', 'x', null, null);
  raise exception 'FAIL: authenticated executed decide_record_review';
exception when insufficient_privilege then raise notice 'ok - signed-in users cannot call review functions directly';
end $$;
reset role;
set role anon;
select pg_temp.assert((select count(*) from public.subjects) = 0, 'anon reads no subjects');
reset role;
select pg_temp.assert(not exists (select 1 from pg_tables where schemaname = 'public' and not rowsecurity), 'RLS enabled on every public table after 008');

-- 12. Retrieval (migration 009): chunks only from trusted content, scope before rank, audited, injection-safe.
select pg_temp.assert(private.fold_text('Četverougao ĆUPRIJA Größe Đak') = 'cetverougao cuprija grosse dak', 'diacritics and case are folded for search');
set role service_role;
select pg_temp.expect_error($$select public.rebuild_canon_chunks('00000000-0000-0000-0000-00000000000b', null)$$,
  'FORBIDDEN', 'a subject teacher cannot build the index');
create temp table t_build as select public.rebuild_canon_chunks('00000000-0000-0000-0000-00000000000a', null) as result;
select pg_temp.assert((select (result ->> 'question_chunks_added')::int from t_build) = 2, 'every trusted question version becomes a chunk');
select pg_temp.assert((select (result ->> 'rule_chunks_added')::int from t_build) = 1, 'only confirmed rules become chunks');
select pg_temp.assert((select count(*) from public.canonical_chunks c join public.ingested_records r on r.record_key = 'MAT-5.1.3' where c.citation ->> 'record_key' = 'MAT-5.1.3') = 0, 'untrusted records never become chunks');
select pg_temp.assert(not exists (select 1 from public.canonical_chunks where content like '%c)%' and source_kind = 'question_version' and citation ->> 'record_key' = 'MAT-5.1.1' and content not like '%Test?%'), 'chunks carry canonical text, not answer keys');
select pg_temp.assert((select (public.rebuild_canon_chunks('00000000-0000-0000-0000-00000000000a', null) ->> 'question_chunks_added')::int) = 0, 'rebuilding adds nothing twice');
select pg_temp.assert(exists (select 1 from public.audit_logs where action = 'retrieval.index_built'), 'index build audited');

select pg_temp.expect_error($$select * from public.retrieve_canon('00000000-0000-0000-0000-00000000000c', 'test', null, 5)$$,
  'FORBIDDEN', 'a student cannot retrieve staff canon yet');
select pg_temp.expect_error($$select * from public.retrieve_canon('00000000-0000-0000-0000-00000000000b', 'test', (select id from t_german), 5)$$,
  'FORBIDDEN', 'a teacher cannot search another subject');
select pg_temp.expect_error($$select * from public.retrieve_canon('00000000-0000-0000-0000-00000000000b', 'x', null, 5)$$,
  'VALIDATION', 'a query needs at least two characters');
select pg_temp.expect_error($$select * from public.retrieve_canon('00000000-0000-0000-0000-00000000000b', 'test', null, 50)$$,
  'VALIDATION', 'k is bounded');
select pg_temp.assert((select count(*) from public.retrieve_canon('00000000-0000-0000-0000-00000000000b', 'TEST', null, 5)) = 1,
  'a teacher finds trusted questions of own subject only (case-insensitive)');
select pg_temp.assert((select count(*) from public.retrieve_canon('00000000-0000-0000-0000-00000000000a', 'test', null, 5)) = 2, 'the superadmin searches every subject');
select pg_temp.assert((select count(*) from public.retrieve_canon('00000000-0000-0000-0000-00000000000a', 'traje 60 minuta', (select id from t_german), 5)) = 1, 'confirmed rules are found by their quote');
select pg_temp.assert((select count(*) from public.retrieve_canon('00000000-0000-0000-0000-00000000000a', $q$'; drop table public.canonical_chunks; --$q$, null, 5)) = 0
  and exists (select 1 from public.canonical_chunks), 'an injection string is just a query');
select pg_temp.assert((select count(*) from public.retrieve_canon('00000000-0000-0000-0000-00000000000a', '!!! & | :*', null, 5)) = 0, 'operator-only queries return nothing without error');
select pg_temp.assert(private.search_query('Koliko traje ispit?') = to_tsquery('simple', 'ispi:* | traj:*'), 'questions become an OR query of content words with prefixes for long words');
select pg_temp.assert(private.search_terms('Da li je 60 minuta i der Test') @> array['60', 'minu:*', 'test'] and cardinality(private.search_terms('Da li je 60 minuta i der Test')) = 3, 'function words are dropped, numbers kept');
select pg_temp.assert(private.search_query($q$a & b:* | !c ' ) ($q$) = ''::tsquery, 'query syntax in the text is dropped, never interpreted');
select pg_temp.assert((select count(*) from public.retrieve_canon('00000000-0000-0000-0000-00000000000a', 'koliko minuta traje ispit', (select id from t_german), 5)) = 1, 'a natural question finds the rule by any of its words');
select pg_temp.assert((select count(*) from public.retrieval_audit_logs) >= 5
  and not exists (select 1 from public.retrieval_audit_logs where query_sha256 !~ '^[0-9a-f]{64}$'), 'every retrieval is audited with a query hash');
select pg_temp.assert(exists (select 1 from public.retrieval_audit_logs where query_sha256 = encode(sha256(convert_to('TEST', 'UTF8')), 'hex') and cardinality(returned) = 1),
  'the audit row lists the returned chunks');

-- Superseding the source version removes its content from retrieval.
select public.register_canon_version('00000000-0000-0000-0000-00000000000a', '66666666-6666-6666-6666-666666666601', null, null, '{}'::jsonb,
  '77777777-7777-7777-7777-777777777702', 'x/fixture2.pdf', repeat('2', 64), 'application/pdf', 1, 'Test authority', 'Fixture v2', null, null, null, null, null);
select public.activate_canon_version('00000000-0000-0000-0000-00000000000a', '77777777-7777-7777-7777-777777777702', null, null);
select pg_temp.assert((select count(*) from public.retrieve_canon('00000000-0000-0000-0000-00000000000a', 'test', null, 10)) = 0, 'superseded content is never retrieved');
select pg_temp.assert((select count(*) from public.canonical_dependencies where dependent_table = 'canonical_chunks' and state = 'stale') = 2, 'chunks of the superseded version are marked stale');
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
select pg_temp.assert((select count(*) from public.canonical_chunks) = 0 and (select count(*) from public.retrieval_audit_logs) = 0, 'students read no chunks and no retrieval log');
do $$ begin
  perform public.retrieve_canon('00000000-0000-0000-0000-00000000000c', 'test', null, 5);
  raise exception 'FAIL: authenticated executed retrieve_canon';
exception when insufficient_privilege then raise notice 'ok - signed-in users cannot call retrieve_canon directly';
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select pg_temp.assert((select count(*) from public.retrieval_audit_logs) = 0, 'the retrieval log needs audit.view');
reset role;
select pg_temp.assert(not exists (select 1 from pg_tables where schemaname = 'public' and not rowsecurity), 'RLS enabled on every public table after 009');
