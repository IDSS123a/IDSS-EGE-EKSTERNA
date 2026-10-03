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

-- 13. System settings (migration 012): splash palette set only by settings.manage, validated, audited.
set role service_role;
select pg_temp.expect_error($$select public.set_splash_palette('00000000-0000-0000-0000-00000000000b', '{"red": 2, "yellow": 36, "blue": 29, "sky": 33}', null)$$,
  'FORBIDDEN', 'a teacher cannot change settings');
select pg_temp.expect_error($$select public.set_splash_palette('00000000-0000-0000-0000-00000000000a', '{"red": 2, "yellow": 36, "blue": 29, "sky": 30}', null)$$,
  'VALIDATION', 'shares must add up to 100');
select pg_temp.expect_error($$select public.set_splash_palette('00000000-0000-0000-0000-00000000000a', '{"red": -5, "yellow": 46, "blue": 29, "sky": 30}', null)$$,
  'VALIDATION', 'shares are between 0 and 100');
select pg_temp.expect_error($$select public.set_splash_palette('00000000-0000-0000-0000-00000000000a', '{"red": 2, "yellow": 36, "blue": 29, "sky": 33, "green": 0}', null)$$,
  'VALIDATION', 'only the four IDSS colours');
select pg_temp.expect_error($$select public.set_splash_palette('00000000-0000-0000-0000-00000000000a', '{"red": "2", "yellow": 36, "blue": 29, "sky": 33}', null)$$,
  'VALIDATION', 'shares are numbers');
select public.set_splash_palette('00000000-0000-0000-0000-00000000000a', '{"red": 1.5, "yellow": 40, "blue": 28.5, "sky": 30}', null);
select pg_temp.assert((select value from public.system_settings where key = 'splash.palette') = '{"red": 1.5, "yellow": 40, "blue": 28.5, "sky": 30}'::jsonb, 'the palette is stored');
select pg_temp.assert(exists (select 1 from public.audit_logs where action = 'settings.splash_palette_changed' and details -> 'before' ->> 'red' = '2'), 'the change is audited with before and after');
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select pg_temp.assert((select count(*) from public.system_settings) = 0, 'settings are hidden without settings.manage');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select pg_temp.assert((select count(*) from public.system_settings) = 1, 'the superadmin reads settings');
reset role;
select pg_temp.assert(not exists (select 1 from pg_tables where schemaname = 'public' and not rowsecurity), 'RLS enabled on every public table after 012');

-- 14. Question text revisions (migration 013): texts only, structure fixed, scoped, append-only, audited.
create temp table t_qv as select v.id from public.question_versions v where v.record_id = pg_temp.rid('MAT-5.1.1');
create temp table t_de_qv as select v.id from public.question_versions v where v.record_id = pg_temp.rid('DEU-4.2.1');
grant select on t_qv, t_de_qv to service_role, authenticated;
set role service_role;
select pg_temp.expect_error($$select public.revise_question_text('00000000-0000-0000-0000-00000000000b', (select id from t_de_qv),
  '{"raw_text": "x", "stem_text": "x", "options": [{"label": "a", "text": "0"}], "scored_items": [{"item_number": 1, "raw_text": "A"}, {"item_number": 2, "raw_text": "B"}]}', 'Fusnota', null, null)$$,
  'FORBIDDEN', 'a teacher cannot revise question text of another subject');
select pg_temp.expect_error($$select public.revise_question_text('00000000-0000-0000-0000-00000000000b', (select id from t_qv),
  '{"raw_text": "5.1.1. Test?", "stem_text": "5.1.1. Test?", "options": [{"label": "b", "text": "0"}], "scored_items": []}', 'Fusnota', null, null)$$,
  'VALIDATION', 'option labels cannot change');
select pg_temp.expect_error($$select public.revise_question_text('00000000-0000-0000-0000-00000000000b', (select id from t_qv),
  '{"raw_text": "5.1.1. Test?", "stem_text": "5.1.1. Test?", "options": [], "scored_items": []}', 'Fusnota', null, null)$$,
  'VALIDATION', 'options cannot be removed');
select pg_temp.expect_error($$select public.revise_question_text('00000000-0000-0000-0000-00000000000b', (select id from t_qv),
  '{"raw_text": "5.1.1. Test?", "stem_text": "5.1.1. Test?", "options": [{"label": "a", "text": " "}], "scored_items": []}', 'Fusnota', null, null)$$,
  'VALIDATION', 'option text cannot be empty');
select pg_temp.expect_error($$select public.revise_question_text('00000000-0000-0000-0000-00000000000b', (select id from t_qv),
  '{"raw_text": "5.1.1. Test?", "options": [{"label": "a", "text": "0"}], "scored_items": []}', 'Fusnota', null, null)$$,
  'VALIDATION', 'the stem stays when the version has one');
select pg_temp.expect_error($$select public.revise_question_text('00000000-0000-0000-0000-00000000000b', (select id from t_qv),
  '{"stem_text": "5.1.1. Test?", "options": [{"label": "a", "text": "0"}], "scored_items": []}', 'Fusnota', null, null)$$,
  'VALIDATION', 'the question text is required');
select pg_temp.expect_error($$select public.revise_question_text('00000000-0000-0000-0000-00000000000b', (select id from t_qv),
  '{"raw_text": "5.1.1. Test?", "stem_text": "5.1.1. Test?", "options": "a", "scored_items": []}', 'Fusnota', null, null)$$,
  'VALIDATION', 'options must be a list');
select pg_temp.expect_error($$select public.revise_question_text('00000000-0000-0000-0000-00000000000b', (select id from t_qv),
  '{"raw_text": "5.1.1. Test?", "stem_text": "5.1.1. Test?", "options": [{"label": "a", "text": "0"}], "scored_items": []}', ' ', null, null)$$,
  'VALIDATION', 'a text revision needs a reason');
select pg_temp.expect_error($$select public.revise_question_text('00000000-0000-0000-0000-00000000000b', (select id from t_de_qv),
  '{"raw_text": "x", "stem_text": "x", "options": [{"label": "a", "text": "0"}], "scored_items": [{"item_number": 2, "raw_text": "B"}, {"item_number": 1, "raw_text": "A"}]}', 'Fusnota', null, null)$$,
  'FORBIDDEN', 'scope is checked before shape');
select pg_temp.expect_error($$select public.revise_question_text('00000000-0000-0000-0000-00000000000a', (select id from t_de_qv),
  '{"raw_text": "x", "stem_text": "x", "options": [{"label": "a", "text": "0"}], "scored_items": [{"item_number": 2, "raw_text": "B"}, {"item_number": 1, "raw_text": "A"}]}', 'Fusnota', null, null)$$,
  'VALIDATION', 'scored items keep their numbers and order');
select public.revise_question_text('00000000-0000-0000-0000-00000000000a', (select id from t_de_qv),
  '{"raw_text": "4.2.1. Neu", "stem_text": "4.2.1. Neu", "options": [{"label": "a", "text": "0"}], "scored_items": [{"item_number": 1, "raw_text": " A neu "}, {"item_number": 2, "raw_text": "B"}], "extra": 1}', 'Fusnota', null, null);
select pg_temp.assert((select content from public.question_text_revisions where question_version_id = (select id from t_de_qv))
  = '{"raw_text": "4.2.1. Neu", "stem_text": "4.2.1. Neu", "options": [{"label": "a", "text": "0"}], "scored_items": [{"item_number": 1, "raw_text": "A neu"}, {"item_number": 2, "raw_text": "B"}]}'::jsonb,
  'only known fields are stored, trimmed');
select pg_temp.expect_error($$select public.revise_question_text('00000000-0000-0000-0000-00000000000b', (select id from t_qv),
  '{"raw_text": " 5.1.1. Test? ", "stem_text": "5.1.1. Test?", "options": [{"label": "a", "text": "0"}], "scored_items": []}', 'Bez izmjene', null, null)$$,
  'UNCHANGED', 'a revision that changes nothing is refused (migration 014)');
select public.revise_question_text('00000000-0000-0000-0000-00000000000b', (select id from t_qv),
  jsonb_build_object('raw_text', E'5.1.1. Test?\r\nDrugi red', 'stem_text', '5.1.1. Test?', 'options', '[{"label": "a", "text": "0"}]'::jsonb, 'scored_items', '[]'::jsonb),
  'Tekst fusnote uklonjen', 'Stranica 23, fusnota 1', null);
select pg_temp.assert((select content ->> 'raw_text' from public.question_text_revisions where question_version_id = (select id from t_qv)) = E'5.1.1. Test?\nDrugi red',
  'line breaks are stored as \n (migration 014)');
select pg_temp.expect_error($$select public.revise_question_text('00000000-0000-0000-0000-00000000000b', (select id from t_qv),
  jsonb_build_object('raw_text', E'5.1.1. Test?\nDrugi red', 'stem_text', '5.1.1. Test?', 'options', '[{"label": "a", "text": "0"}]'::jsonb, 'scored_items', '[]'::jsonb), 'Ponovo', null, null)$$,
  'UNCHANGED', 'unchanged compares with the newest revision');
select pg_temp.assert((select raw_text from public.question_versions where id = (select id from t_qv)) = '5.1.1. Test?', 'the trusted version never changes');
select pg_temp.assert(exists (select 1 from public.audit_logs where action = 'review.question_text_revised' and entity_id = (select id::text from t_qv)), 'text revision audited');
reset role;
do $$ begin
  update public.question_text_revisions set reason = 'x';
  raise exception 'FAIL: text revision changed';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'ok - text revisions are append-only';
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select pg_temp.assert((select count(*) from public.question_text_revisions) = 1, 'a teacher reads text revisions of own subject only');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
select pg_temp.assert((select count(*) from public.question_text_revisions) = 0, 'students read no text revisions');
do $$ begin
  perform public.revise_question_text('00000000-0000-0000-0000-00000000000b', gen_random_uuid(), '{}', 'x', null, null);
  raise exception 'FAIL: authenticated executed revise_question_text';
exception when insufficient_privilege then raise notice 'ok - signed-in users cannot call revise_question_text directly';
end $$;
reset role;
select pg_temp.assert(not exists (select 1 from pg_tables where schemaname = 'public' and not rowsecurity), 'RLS enabled on every public table after 013');

-- 15. Semantic retrieval (migration 015): vectors bound to chunk text, scope before rank, audited, service role only.
set role service_role;
select pg_temp.expect_error($$select * from public.pending_chunk_embeddings('00000000-0000-0000-0000-00000000000b', 'gemini-embedding-2', 10)$$,
  'FORBIDDEN', 'a subject teacher cannot build embeddings');
select pg_temp.expect_error($$select * from public.pending_chunk_embeddings('00000000-0000-0000-0000-00000000000a', 'Gemini Embedding', 10)$$,
  'VALIDATION', 'the model name is a plain identifier');
create temp table t_pending as select * from public.pending_chunk_embeddings('00000000-0000-0000-0000-00000000000a', 'gemini-embedding-2', 200);
select pg_temp.assert((select count(*) from t_pending) >= 1
  and not exists (select 1 from t_pending p join public.canonical_chunks c on c.id = p.chunk_id join public.canonical_document_versions v on v.id = c.document_version_id where v.status <> 'active'),
  'pending chunks come from active versions only');
select pg_temp.assert(not exists (select 1 from t_pending p join public.canonical_chunks c on c.id = p.chunk_id where p.content_sha256 <> encode(sha256(convert_to(c.content, 'UTF8')), 'hex')),
  'pending chunks carry the hash of their text');
select pg_temp.expect_error($$select public.store_chunk_embeddings('00000000-0000-0000-0000-00000000000a', 'gemini-embedding-2',
  jsonb_build_array(jsonb_build_object('chunk_id', (select chunk_id from t_pending limit 1), 'content_sha256', repeat('0', 64), 'embedding', to_jsonb(array_fill(0.01::real, array[768])))), null)$$,
  'VALIDATION', 'a vector is stored only for the text it was computed from');
select pg_temp.expect_error($$select public.store_chunk_embeddings('00000000-0000-0000-0000-00000000000a', 'gemini-embedding-2',
  jsonb_build_array(jsonb_build_object('chunk_id', (select chunk_id from t_pending limit 1), 'content_sha256', (select content_sha256 from t_pending limit 1), 'embedding', to_jsonb(array_fill(0.01::real, array[767])))), null)$$,
  'VALIDATION', 'vectors have 768 dimensions');
select pg_temp.expect_error($$select public.store_chunk_embeddings('00000000-0000-0000-0000-00000000000b', 'gemini-embedding-2',
  jsonb_build_array(jsonb_build_object('chunk_id', (select chunk_id from t_pending limit 1), 'content_sha256', (select content_sha256 from t_pending limit 1), 'embedding', to_jsonb(array_fill(0.01::real, array[768])))), null)$$,
  'FORBIDDEN', 'a subject teacher cannot store embeddings');
create temp table t_rows as select jsonb_agg(jsonb_build_object('chunk_id', chunk_id, 'content_sha256', content_sha256, 'embedding', to_jsonb(array_fill(0.01::real, array[768])))) as rows from t_pending;
select pg_temp.assert(public.store_chunk_embeddings('00000000-0000-0000-0000-00000000000a', 'gemini-embedding-2', (select rows from t_rows), null) = (select count(*) from t_pending),
  'every pending chunk gets its vector');
select pg_temp.assert(public.store_chunk_embeddings('00000000-0000-0000-0000-00000000000a', 'gemini-embedding-2', (select rows from t_rows), null) = 0, 'storing twice adds nothing');
select pg_temp.assert((select count(*) from public.pending_chunk_embeddings('00000000-0000-0000-0000-00000000000a', 'gemini-embedding-2', 200)) = 0, 'nothing is pending afterwards');
select pg_temp.assert(exists (select 1 from public.audit_logs where action = 'retrieval.embeddings_stored'), 'storing embeddings is audited');

select pg_temp.expect_error($$select * from public.retrieve_canon_semantic('00000000-0000-0000-0000-00000000000b', 'koliko traje', array_fill(0.01::real, array[768]), 'gemini-embedding-2', (select id from t_german), 5)$$,
  'FORBIDDEN', 'a teacher cannot search another subject semantically');
select pg_temp.expect_error($$select * from public.retrieve_canon_semantic('00000000-0000-0000-0000-00000000000a', 'koliko traje', array_fill(0.01::real, array[10]), 'gemini-embedding-2', null, 5)$$,
  'VALIDATION', 'the query vector has 768 dimensions');
select pg_temp.expect_error($$select * from public.retrieve_canon_semantic('00000000-0000-0000-0000-00000000000c', 'koliko traje', array_fill(0.01::real, array[768]), 'gemini-embedding-2', null, 5)$$,
  'FORBIDDEN', 'a student cannot search staff canon');
create temp table t_semantic as select * from public.retrieve_canon_semantic('00000000-0000-0000-0000-00000000000a', 'koliko minuta traje ispit', array_fill(0.01::real, array[768]), 'gemini-embedding-2', null, 5);
select pg_temp.assert((select count(*) from t_semantic) >= 1 and not exists (select 1 from t_semantic where similarity is null or similarity < 0.99),
  'semantic results carry their cosine similarity');
select pg_temp.assert(exists (select 1 from t_semantic where keyword_rank >= 1), 'the keyword rank is fused in (reciprocal rank fusion)');
select pg_temp.assert(not exists (select 1 from t_semantic where similarity_z is not null), 'without spread in the field no passage stands out (z is null, migration 016)');
select pg_temp.assert((select top_similarity from public.retrieval_audit_logs where method = 'semantic' order by id desc limit 1) >= 0.99,
  'the audit keeps the top similarity of a semantic search, not the query');
select pg_temp.assert(not exists (select 1 from t_semantic s join public.canonical_document_versions v on v.id = s.document_version_id where v.status <> 'active'),
  'superseded content is never retrieved semantically');
select pg_temp.assert(exists (select 1 from public.retrieval_audit_logs where method = 'semantic' and query_sha256 = encode(sha256(convert_to('koliko minuta traje ispit', 'UTF8')), 'hex')),
  'semantic retrieval is audited with the query hash and method');
reset role;
do $$ begin
  update public.canonical_chunk_embeddings set model = 'x';
  raise exception 'FAIL: embedding changed';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'ok - embeddings are append-only';
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
select pg_temp.assert((select count(*) from public.canonical_chunk_embeddings) = 0, 'students read no embeddings');
do $$ begin
  perform public.retrieve_canon_semantic('00000000-0000-0000-0000-00000000000a', 'test', array_fill(0.01::real, array[768]), 'gemini-embedding-2', null, 5);
  raise exception 'FAIL: authenticated executed retrieve_canon_semantic';
exception when insufficient_privilege then raise notice 'ok - signed-in users cannot call semantic retrieval directly';
end $$;
reset role;
select pg_temp.assert(not exists (select 1 from pg_tables where schemaname = 'public' and not rowsecurity), 'RLS enabled on every public table after 015');


-- 17. Practice (migration 017): questions without keys, solution only after the answer, auto-check by the effective key.
set role service_role;
select public.activate_canon_version('00000000-0000-0000-0000-00000000000a', '77777777-7777-7777-7777-777777777701', 'Test: practice fixtures', null);
select pg_temp.expect_error($$select public.practice_next('00000000-0000-0000-0000-00000000000b', '11111111-1111-1111-1111-111111111111', null)$$,
  'FORBIDDEN', 'staff without practice.participate cannot practise');
select pg_temp.expect_error($$select public.practice_next('00000000-0000-0000-0000-00000000000c', gen_random_uuid(), null)$$,
  'VALIDATION', 'practice needs an existing subject');
create temp table t_q_math as select public.practice_next('00000000-0000-0000-0000-00000000000c', '11111111-1111-1111-1111-111111111111', null) as q;
select pg_temp.assert((select q ->> 'record_key' from t_q_math) = 'MAT-5.1.1', 'a trusted question of an active version is offered');
select pg_temp.assert((select q -> 'items' -> 0 ->> 'mode' from t_q_math) = 'choice', 'a single-choice question with a letter key is answered by choice');
select pg_temp.assert(position('c)' in (select q::text from t_q_math)) = 0 and position('b)' in (select q::text from t_q_math)) = 0
  and position('solution' in (select q::text from t_q_math)) = 0, 'the offered question carries no key and no solution');
create temp table t_q_german as select public.practice_next('00000000-0000-0000-0000-00000000000c', (select id from t_german), null) as q;
select pg_temp.assert((select jsonb_agg(i ->> 'mode') from t_q_german, jsonb_array_elements(q -> 'items') i) = '["true_false", "true_false"]'::jsonb,
  'true/false items are answered per item');
select pg_temp.expect_error($$select public.practice_submit('00000000-0000-0000-0000-00000000000c', (select (q ->> 'question_version_id')::uuid from t_q_math), '[]'::jsonb)$$,
  'VALIDATION', 'an answer covers every item');
select pg_temp.expect_error($$select public.practice_submit('00000000-0000-0000-0000-00000000000c', (select (q ->> 'question_version_id')::uuid from t_q_math), '[{"item": null, "response": 5}]'::jsonb)$$,
  'VALIDATION', 'responses are text');
-- The printed key of MAT-5.1.1 is c); a revision (section 11) proposed b). P-15 (migration 020): the printed key is
-- always the key; revisions are history only.
create temp table t_sub1 as select public.practice_submit('00000000-0000-0000-0000-00000000000c', (select (q ->> 'question_version_id')::uuid from t_q_math), '[{"item": null, "response": "b"}]'::jsonb) as r;
select pg_temp.assert((select r ->> 'outcome' from t_sub1) = 'incorrect' and (select r -> 'results' -> 0 ->> 'solution' from t_sub1) = 'c)',
  'the answer is checked against the printed key, not a revision, and the solution is returned after the answer');
create temp table t_sub2 as select public.practice_submit('00000000-0000-0000-0000-00000000000c', (select (q ->> 'question_version_id')::uuid from t_q_math), '[{"item": null, "response": " C "}]'::jsonb) as r;
select pg_temp.assert((select r ->> 'outcome' from t_sub2) = 'correct', 'the printed key counts, case and spaces aside');
create temp table t_sub3 as select public.practice_submit('00000000-0000-0000-0000-00000000000c', (select (q ->> 'question_version_id')::uuid from t_q_german),
  '[{"item": 1, "response": "r"}, {"item": 2, "response": "r"}]'::jsonb) as r;
select pg_temp.assert((select r ->> 'outcome' from t_sub3) = 'partly_correct' and (select (r ->> 'items_correct')::int from t_sub3) = 1, 'items are checked one by one');
select pg_temp.assert((select public.practice_next('00000000-0000-0000-0000-00000000000c', '11111111-1111-1111-1111-111111111111', null) ->> 'record_key') = 'MAT-5.1.1',
  'the only question of the subject is offered again');
create temp table t_overview as select public.practice_overview('00000000-0000-0000-0000-00000000000c') as o;
select pg_temp.assert((select (o ->> 'today')::int from t_overview) = 3, 'answers of today are counted for the daily mission');
select pg_temp.assert((select (a ->> 'correct')::int from t_overview, jsonb_array_elements(o -> 'areas') a where a ->> 'subject_code' = 'mathematics') = 1
  and (select (a ->> 'answered')::int from t_overview, jsonb_array_elements(o -> 'areas') a where a ->> 'subject_code' = 'mathematics') = 1,
  'mastery counts the latest answer per question');
select pg_temp.assert(jsonb_array_length((select o -> 'days' from t_overview)) = 1, 'practice days are listed for the streak');
select public.practice_overview('00000000-0000-0000-0000-00000000000d');
select pg_temp.assert(exists (select 1 from public.persons where profile_user_id = '00000000-0000-0000-0000-00000000000d'), 'a student gets a person on first practice');
reset role;
do $$ begin
  update public.practice_answers set outcome = 'correct';
  raise exception 'FAIL: practice answer changed';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'ok - practice answers are append-only';
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
select pg_temp.assert((select count(*) from public.practice_answers) = 3, 'a student reads own practice answers');
select pg_temp.assert((select count(*) from public.answer_keys) = 0 and (select count(*) from public.question_versions) = 0, 'a student still reads no keys and no questions directly');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', false);
select pg_temp.assert((select count(*) from public.practice_answers) = 0, 'a student reads no answers of others');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select pg_temp.assert((select count(*) from public.practice_answers) = 2, 'a subject teacher reads practice answers of own subject only');
do $$ begin
  perform public.practice_next('00000000-0000-0000-0000-00000000000c', '11111111-1111-1111-1111-111111111111', null);
  raise exception 'FAIL: authenticated executed practice_next';
exception when insufficient_privilege then raise notice 'ok - signed-in users cannot call practice functions directly';
end $$;
reset role;
select pg_temp.assert(not exists (select 1 from pg_tables where schemaname = 'public' and not rowsecurity), 'RLS enabled on every public table after 017');

-- 18. Mock exams (migration 019): confirmed blueprint, generation from trusted tasks, no key before the teacher's
--     confirmation, pre-scoring by the effective key, grading with allowed points only, release, frozen result.
set role service_role;
create function pg_temp.blueprint(p_items integer, p_format text) returns jsonb language sql as $$
  select jsonb_build_object('distinct_area', false, 'positions', jsonb_build_array(jsonb_build_object(
    'position', 1, 'format', p_format, 'scoring', 'per_item', 'points', 10, 'item_points', 10.0 / p_items, 'items', p_items,
    'pool', jsonb_build_array(jsonb_build_object('key', '^DEU-4\.2\.([0-9]+)$', 'from', 1, 'to', 10)))))
$$;
select pg_temp.expect_error($$select public.load_exam_blueprint('00000000-0000-0000-0000-00000000000b', 'german', 't1', pg_temp.blueprint(2, 'task'), repeat('a', 64), null)$$,
  'FORBIDDEN', 'only a publisher loads a blueprint');
select pg_temp.expect_error($$select public.load_exam_blueprint('00000000-0000-0000-0000-00000000000a', 'german', 't1',
  jsonb_set(pg_temp.blueprint(2, 'task'), '{positions,0,points}', '9'), repeat('a', 64), null)$$,
  'POINTS_MISMATCH', 'blueprint points must add up to the confirmed total');
select pg_temp.expect_error($$select public.load_exam_blueprint('00000000-0000-0000-0000-00000000000a', 'german', 't1',
  jsonb_set(pg_temp.blueprint(2, 'task'), '{positions,0,scoring}', '"free"'), repeat('a', 64), null)$$,
  'VALIDATION', 'blueprint positions are validated');
create temp table t_bp as select public.load_exam_blueprint('00000000-0000-0000-0000-00000000000a', 'german', 't1', pg_temp.blueprint(2, 'task'), repeat('a', 64), null) as id;
select pg_temp.assert((select public.load_exam_blueprint('00000000-0000-0000-0000-00000000000a', 'german', 't1', pg_temp.blueprint(2, 'task'), repeat('a', 64), null)) = (select id from t_bp),
  'loading the same blueprint again is idempotent');
select pg_temp.expect_error($$select public.load_exam_blueprint('00000000-0000-0000-0000-00000000000a', 'german', 't1', pg_temp.blueprint(2, 'task'), repeat('b', 64), null)$$,
  'VERSION_EXISTS', 'a version is never replaced by other content');
select pg_temp.expect_error($$select public.mock_exam_start('00000000-0000-0000-0000-00000000000c', (select id from t_german), null)$$,
  'NO_BLUEPRINT', 'no mock exam before a reviewer confirms the blueprint');
select pg_temp.expect_error($$select public.review_exam_blueprint('00000000-0000-0000-0000-00000000000b', (select id from t_bp), 'confirmed', null, null)$$,
  'FORBIDDEN', 'a teacher of another subject cannot confirm');
select pg_temp.expect_error($$select public.review_exam_blueprint('00000000-0000-0000-0000-00000000000a', (select id from t_bp), 'rejected', ' ', null)$$,
  'VALIDATION', 'a rejection needs a reason');
select public.review_exam_blueprint('00000000-0000-0000-0000-00000000000a', (select id from t_bp), 'confirmed', null, null);
select pg_temp.expect_error($$select public.mock_exam_start('00000000-0000-0000-0000-00000000000b', (select id from t_german), null)$$,
  'FORBIDDEN', 'staff cannot take a mock exam');
create temp table t_exam as select public.mock_exam_start('00000000-0000-0000-0000-00000000000c', (select id from t_german), null) as id;
select pg_temp.assert((select public.mock_exam_start('00000000-0000-0000-0000-00000000000c', (select id from t_german), null)) = (select id from t_exam),
  'starting again returns the mock exam in progress');
-- Migration 024: a requested set notifies the subject's teachers once, so it never waits for approval unseen.
select pg_temp.assert((select count(*) from public.notifications where kind = 'mock_exam_requested' and entity_id = (select id from t_exam)) >= 1
  and (select count(distinct recipient_user_id) from public.notifications where kind = 'mock_exam_requested' and entity_id = (select id from t_exam))
    = (select count(*) from public.notifications where kind = 'mock_exam_requested' and entity_id = (select id from t_exam)),
  'a requested set notifies each teacher of the subject once, also when the student asks again');
-- P-15 (migration 020): the set waits for a teacher; the student sees no question before approval and start.
select pg_temp.assert((select status from public.mock_exams where id = (select id from t_exam)) = 'awaiting_approval'
  and (select deadline_at from public.mock_exams where id = (select id from t_exam)) is null, 'a generated set waits for a teacher, no time runs');
select pg_temp.assert(jsonb_array_length(public.mock_exam_view('00000000-0000-0000-0000-00000000000c', (select id from t_exam)) -> 'items') = 0,
  'the student sees no question before approval');
select pg_temp.expect_error($$select public.mock_exam_begin('00000000-0000-0000-0000-00000000000c', (select id from t_exam), null)$$,
  'NOT_APPROVED', 'an unapproved set cannot be started');
select pg_temp.expect_error($$select public.mock_exam_approve('00000000-0000-0000-0000-00000000000b', (select id from t_exam), null)$$,
  'FORBIDDEN', 'a teacher of another subject cannot approve');
select pg_temp.assert((select public.grading_view('00000000-0000-0000-0000-00000000000a', (select id from t_exam)) -> 'items' -> 0 ->> 'solution') = 'r',
  'the approving teacher sees the printed key of every question');
select pg_temp.expect_error($$select public.mock_exam_discard('00000000-0000-0000-0000-00000000000a', (select id from t_exam), ' ', true, null)$$,
  'VALIDATION', 'discarding a set needs a reason');
update t_exam set id = public.mock_exam_discard('00000000-0000-0000-0000-00000000000a', (select id from t_exam), 'Test: new set', true, null);
select pg_temp.assert((select count(*) from public.mock_exams where status = 'discarded') = 1 and (select status from public.mock_exams where id = (select id from t_exam)) = 'awaiting_approval',
  'a discarded set is replaced by a new one waiting for approval');
select public.mock_exam_approve('00000000-0000-0000-0000-00000000000a', (select id from t_exam), null);
select public.mock_exam_begin('00000000-0000-0000-0000-00000000000c', (select id from t_exam), null);
select pg_temp.assert((select deadline_at - started_at from public.mock_exams where id = (select id from t_exam)) = interval '60 minutes',
  'the official duration runs from the student''s start');
create temp table t_view as select public.mock_exam_view('00000000-0000-0000-0000-00000000000c', (select id from t_exam)) as v;
select pg_temp.assert(jsonb_array_length((select v -> 'items' from t_view)) = 2 and (select (v ->> 'max_points')::numeric from t_view) = 10,
  'a whole task becomes one unit per scored item, worth the blueprint points');
select pg_temp.assert(not exists (select 1 from t_view, jsonb_array_elements(v -> 'items') i
  where i ->> 'solution' is not null or i ->> 'proposed_points' is not null or i ->> 'final_points' is not null)
  and (select v ->> 'total_points' from t_view) is null, 'the student view carries no solution and no points');
select pg_temp.expect_error($$select public.mock_exam_view('00000000-0000-0000-0000-00000000000d', (select id from t_exam))$$,
  'NOT_FOUND', 'another student cannot open the mock exam');
select pg_temp.expect_error($$select public.mock_exam_save('00000000-0000-0000-0000-00000000000c', (select id from t_exam), jsonb_build_array(jsonb_build_object('id', gen_random_uuid()::text, 'response', 'r')))$$,
  'VALIDATION', 'answers only for units of the exam');
select public.mock_exam_save('00000000-0000-0000-0000-00000000000c', (select id from t_exam),
  (select jsonb_agg(jsonb_build_object('id', i ->> 'id', 'response', 'f')) from t_view, jsonb_array_elements(v -> 'items') i));
select public.mock_exam_submit('00000000-0000-0000-0000-00000000000c', (select id from t_exam),
  (select jsonb_agg(jsonb_build_object('id', i ->> 'id', 'response', 'r')) from t_view, jsonb_array_elements(v -> 'items') i), null);
select pg_temp.assert((select array_agg(proposed_points order by item_number) from public.mock_exam_items where mock_exam_id = (select id from t_exam)) = array[5.00, 0.00]::numeric[],
  'closed units are pre-scored by the key (item 1 r correct, item 2 r wrong)');
select pg_temp.assert((select status from public.mock_exams where id = (select id from t_exam)) = 'submitted', 'the mock exam is submitted');
select pg_temp.expect_error($$select public.mock_exam_save('00000000-0000-0000-0000-00000000000c', (select id from t_exam), '[]'::jsonb)$$,
  'CLOSED', 'answers cannot change after submission');
select pg_temp.assert((select public.mock_exam_view('00000000-0000-0000-0000-00000000000c', (select id from t_exam)) -> 'items' -> 0 ->> 'solution') is null,
  'no solution after submission before the teacher confirms');
select pg_temp.assert(exists (select 1 from public.notifications where kind = 'mock_exam_submitted' and entity_id = (select id from t_exam)),
  'the subject teachers are notified of the submission');
select pg_temp.expect_error($$select public.grading_view('00000000-0000-0000-0000-00000000000b', (select id from t_exam))$$,
  'FORBIDDEN', 'a teacher of another subject cannot grade');
select pg_temp.assert((select public.grading_view('00000000-0000-0000-0000-00000000000a', (select id from t_exam)) -> 'items' -> 1 ->> 'solution') = 'f',
  'the grader sees the solution');
select pg_temp.assert(jsonb_array_length(public.grading_queue('00000000-0000-0000-0000-00000000000a')) = 1, 'the submitted exam is in the grading queue');
select pg_temp.expect_error($$select public.grading_save('00000000-0000-0000-0000-00000000000a', (select id from t_exam),
  jsonb_build_array(jsonb_build_object('id', (select id::text from public.mock_exam_items where mock_exam_id = (select id from t_exam) and item_number = 2), 'points', 3)), null)$$,
  'VALIDATION', 'only points the rule allows');
select public.grading_save('00000000-0000-0000-0000-00000000000a', (select id from t_exam),
  jsonb_build_array(jsonb_build_object('id', (select id::text from public.mock_exam_items where mock_exam_id = (select id from t_exam) and item_number = 2), 'points', 5, 'note', 'Prihvaćeno')), null);
select pg_temp.assert((select public.grading_confirm('00000000-0000-0000-0000-00000000000a', (select id from t_exam), null)) = 10,
  'confirmation totals the teacher''s points and accepted proposals');
select pg_temp.assert(exists (select 1 from public.notifications where kind = 'mock_exam_graded' and recipient_user_id = '00000000-0000-0000-0000-00000000000c'),
  'the student is notified of the result');
create temp table t_result as select public.mock_exam_view('00000000-0000-0000-0000-00000000000c', (select id from t_exam)) as v;
select pg_temp.assert((select (v ->> 'total_points')::numeric from t_result) = 10 and (select v -> 'items' -> 1 ->> 'note' from t_result) = 'Prihvaćeno'
  and (select v -> 'items' -> 1 ->> 'solution' from t_result) = 'f', 'after confirmation the student sees points, notes and solutions');
select pg_temp.expect_error($$select public.grading_save('00000000-0000-0000-0000-00000000000a', (select id from t_exam),
  jsonb_build_array(jsonb_build_object('id', (select id::text from public.mock_exam_items where mock_exam_id = (select id from t_exam) limit 1), 'points', 0)), null)$$,
  'CLOSED', 'a confirmed result is not graded again');
-- A blueprint that needs more distinct tasks than exist cannot start a mock exam.
select public.review_exam_blueprint('00000000-0000-0000-0000-00000000000a',
  public.load_exam_blueprint('00000000-0000-0000-0000-00000000000a', 'german', 't2', pg_temp.blueprint(2, 'items'), repeat('c', 64), null), 'confirmed', null, null);
select pg_temp.expect_error($$select public.mock_exam_start('00000000-0000-0000-0000-00000000000c', (select id from t_german), null)$$,
  'BLUEPRINT_UNFILLABLE', 'a position without enough trusted tasks is reported, not filled with anything else');
reset role;
do $$ begin
  update public.mock_exam_items set final_points = 0 where mock_exam_id = (select id from t_exam);
  raise exception 'FAIL: graded unit changed';
exception when others then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'ok - a graded mock exam is frozen';
end $$;
do $$ begin
  update public.exam_blueprints set version = 'x';
  raise exception 'FAIL: blueprint changed';
exception when raise_exception then
  if sqlerrm like 'FAIL%' then raise; end if;
  raise notice 'ok - blueprints are append-only';
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
select pg_temp.assert((select count(*) from public.mock_exams) = 2 and (select count(*) from public.mock_exam_items) = 2,
  'a student reads own mock exams (also the discarded set) and the units of the graded one only');
select pg_temp.assert((select count(*) from public.exam_blueprints) = 0, 'a student reads no blueprint');
select pg_temp.assert((select count(*) from public.notifications) = 1, 'a student reads own notifications only');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select pg_temp.assert((select count(*) from public.mock_exams) = 0 and (select count(*) from public.mock_exam_items) = 0, 'a teacher of another subject reads no mock exam');
do $$ begin
  perform public.mock_exam_start('00000000-0000-0000-0000-00000000000c', gen_random_uuid(), null);
  raise exception 'FAIL: authenticated executed mock_exam_start';
exception when insufficient_privilege then raise notice 'ok - signed-in users cannot call mock exam functions directly';
end $$;
reset role;
select pg_temp.assert(not exists (select 1 from pg_tables where schemaname = 'public' and not rowsecurity), 'RLS enabled on every public table after 019');

-- 19. Canon fidelity (migration 020, P-15): errata never change text or key and are shown as notices; follow-ups;
--     teacher verdicts on practice answers; matching graded by correct pairs.
set role service_role;
create temp table t_dq as select (q ->> 'question_version_id')::uuid as id from t_q_german;
select pg_temp.expect_error($$select public.record_catalogue_erratum('00000000-0000-0000-0000-00000000000c', (select id from t_dq), 1, 'x', 'y', null)$$,
  'FORBIDDEN', 'a student cannot record an erratum');
select pg_temp.expect_error($$select public.record_catalogue_erratum('00000000-0000-0000-0000-00000000000a', (select id from t_dq), 9, 'x', 'y', null)$$,
  'VALIDATION', 'an erratum names an existing item');
create temp table t_err as select public.record_catalogue_erratum('00000000-0000-0000-0000-00000000000a', (select id from t_dq), 1,
  'Printed key r is false: the text says otherwise.', 'C14 p. 65', null) as id;
select pg_temp.assert((select printed_answer from public.answer_keys where question_version_id = (select id from t_dq) and item_number = 1) = 'r',
  'an erratum does not change the printed key');
select pg_temp.assert((select public.practice_next('00000000-0000-0000-0000-00000000000d', (select id from t_german), null) -> 'errata') = '[{"item": 1}]'::jsonb,
  'before answering, the student learns only that the source has an error at item 1');
create temp table t_sub_err as select public.practice_submit('00000000-0000-0000-0000-00000000000d', (select id from t_dq),
  '[{"item": 1, "response": "r"}, {"item": 2, "response": "f"}]'::jsonb) as r;
select pg_temp.assert((select r ->> 'outcome' from t_sub_err) = 'correct' and (select r -> 'errata' -> 0 ->> 'evidence' from t_sub_err) = 'C14 p. 65',
  'the printed key still decides, and after answering the student reads the erratum');
select pg_temp.expect_error($$select public.withdraw_catalogue_erratum('00000000-0000-0000-0000-00000000000a', (select id from t_err), '', null)$$,
  'VALIDATION', 'withdrawing an erratum needs a reason');
select public.withdraw_catalogue_erratum('00000000-0000-0000-0000-00000000000a', (select id from t_err), 'Recorded by mistake', null);
select pg_temp.assert((select public.practice_next('00000000-0000-0000-0000-00000000000d', (select id from t_german), null) -> 'errata') = '[]'::jsonb,
  'a withdrawn erratum is no longer shown');
-- Provisional acceptance: an open follow-up names who must still review.
create temp table t_fu as select public.open_canon_follow_up('00000000-0000-0000-0000-00000000000a', (select id from t_dq), 'Nikolina Todorović',
  'Privremeno prihvaćeno; pregled prije zvaničnosti.', null) as id;
select pg_temp.expect_error($$select public.open_canon_follow_up('00000000-0000-0000-0000-00000000000b', (select id from t_dq), 'X', 'Y', null)$$,
  'FORBIDDEN', 'only a reviewer of the subject opens a follow-up');
select public.resolve_canon_follow_up('00000000-0000-0000-0000-00000000000a', (select id from t_fu), 'Pregledano', null);
select pg_temp.expect_error($$select public.resolve_canon_follow_up('00000000-0000-0000-0000-00000000000a', (select id from t_fu), 'again', null)$$,
  'NOT_FOUND', 'a follow-up is resolved once');
reset role;
-- An answer waiting for the teacher (an open task) and a matching rule for the German fixture subject.
insert into public.practice_answers (person_id, question_version_id, subject_id, responses, results, outcome, items_checked, items_correct)
values ('22222222-2222-2222-2222-22222222222c', (select id from t_dq), (select id from t_german), '[{"item": null, "response": "Text"}]',
        '[{"item": null, "mode": "open", "correct": null}]', 'awaiting_teacher', 0, 0);
insert into public.canonical_rules (subject_id, source_version_id, rule_code, value, evidence, facts_version, loaded_by)
select id, source_version_id, 'exam.scoring', '{"matching_points_by_correct_pairs": {"0": 0, "1": 0, "2": 0.5, "3": 0.5, "4": 1}}',
       '[{"page": 8, "quote": "test"}]', facts_version, '00000000-0000-0000-0000-00000000000a' from public.subjects where id = (select id from t_german);
set role service_role;
select pg_temp.assert(jsonb_array_length(public.practice_review_queue('00000000-0000-0000-0000-00000000000a')) = 1
  and (select public.practice_review_queue('00000000-0000-0000-0000-00000000000a') -> 0 -> 'keys' -> 0 ->> 'key') = 'r',
  'the teacher sees the answer waiting for review with the printed key');
select pg_temp.expect_error($$select public.review_practice_answer('00000000-0000-0000-0000-00000000000a',
  (select id from public.practice_answers where outcome = 'awaiting_teacher' limit 1), 'maybe', null, null)$$, 'VALIDATION', 'a verdict is correct, partly correct or incorrect');
select public.review_practice_answer('00000000-0000-0000-0000-00000000000a', (select id from public.practice_answers where outcome = 'awaiting_teacher' limit 1), 'correct', 'Dobro', null);
select pg_temp.assert(jsonb_array_length(public.practice_review_queue('00000000-0000-0000-0000-00000000000a')) = 0
  and (select (a ->> 'awaiting')::int from jsonb_array_elements(public.practice_overview('00000000-0000-0000-0000-00000000000c') -> 'areas') a
       where a ->> 'subject_code' = 'german') = 0, 'a reviewed answer leaves the queue and counts with the teacher''s verdict');
-- Matching units are graded by correct pairs, converted by the confirmed rule.
create function pg_temp.matching_blueprint() returns jsonb language sql as $$
  select jsonb_build_object('distinct_area', false, 'positions', jsonb_build_array(jsonb_build_object(
    'position', 1, 'format', 'matching', 'scoring', 'matching', 'points', 10,
    'pool', jsonb_build_array(jsonb_build_object('key', '^DEU-4\.2\.([0-9]+)$', 'from', 1, 'to', 10)))))
$$;
select public.review_exam_blueprint('00000000-0000-0000-0000-00000000000a',
  public.load_exam_blueprint('00000000-0000-0000-0000-00000000000a', 'german', 't3', pg_temp.matching_blueprint(), repeat('d', 64), null), 'confirmed', null, null);
create temp table t_mexam as select public.mock_exam_start('00000000-0000-0000-0000-00000000000c', (select id from t_german), null) as id;
select public.mock_exam_approve('00000000-0000-0000-0000-00000000000a', (select id from t_mexam), null);
select public.mock_exam_begin('00000000-0000-0000-0000-00000000000c', (select id from t_mexam), null);
select public.mock_exam_submit('00000000-0000-0000-0000-00000000000c', (select id from t_mexam),
  (select jsonb_agg(jsonb_build_object('id', id::text, 'response', 'a1 b2 c3 d4')) from public.mock_exam_items where mock_exam_id = (select id from t_mexam)), null);
select pg_temp.expect_error($$select public.grading_save('00000000-0000-0000-0000-00000000000a', (select id from t_mexam),
  jsonb_build_array(jsonb_build_object('id', (select id::text from public.mock_exam_items where mock_exam_id = (select id from t_mexam)), 'points', 1)), null)$$,
  'VALIDATION', 'a matching unit takes the number of correct pairs, not points');
select pg_temp.expect_error($$select public.grading_save('00000000-0000-0000-0000-00000000000a', (select id from t_mexam),
  jsonb_build_array(jsonb_build_object('id', (select id::text from public.mock_exam_items where mock_exam_id = (select id from t_mexam)), 'pairs', 5)), null)$$,
  'VALIDATION', 'only pair counts the rule knows');
select public.grading_save('00000000-0000-0000-0000-00000000000a', (select id from t_mexam),
  jsonb_build_array(jsonb_build_object('id', (select id::text from public.mock_exam_items where mock_exam_id = (select id from t_mexam)), 'pairs', 3)), null);
select pg_temp.assert((select final_points from public.mock_exam_items where mock_exam_id = (select id from t_mexam)) = 0.5,
  'three correct pairs give 0.5 points by the rule');
reset role;
select pg_temp.assert(not exists (select 1 from pg_tables where schemaname = 'public' and not rowsecurity), 'RLS enabled on every public table after 020');

-- 20. Gamification (migration 025, PDL-029): XP and badges are derived read-only from the student's own events and never
-- change a score.
create temp table t_gvalues as select '{"mission_goal": 5, "xp": {"answer_correct": 10, "answer_partly_correct": 5, "answer_incorrect": 2, "mission_completed": 20, "practice_day": 5, "mock_exam_submitted": 30, "mock_exam_point": 10, "mock_exam_points_cap": 100}, "badges": {"streak_days": 7, "answers_in_subject": 50}}'::jsonb as v;
create temp table t_scores_before as select id, status, total_points from public.mock_exams;
create temp table t_g as select public.gamification_overview('00000000-0000-0000-0000-00000000000c', (select v from t_gvalues)) as g;
select pg_temp.assert((select provolatile from pg_proc where proname = 'gamification_overview') = 's', 'the XP function is declared stable (it cannot write)');
select pg_temp.assert(not exists (
    select 1 from public.mock_exams e full join t_scores_before b on b.id = e.id
    where b.id is null or e.id is null or b.status is distinct from e.status or b.total_points is distinct from e.total_points),
  'reading XP changes no mock exam and no score');
select pg_temp.assert((select (g -> 'xp' ->> 'answers')::numeric from t_g) = (
    select coalesce(sum(case private.practice_outcome(pa.id) when 'correct' then 10 when 'partly_correct' then 5 when 'incorrect' then 2 else 0 end), 0)
    from public.practice_answers pa join public.persons p on p.id = pa.person_id where p.profile_user_id = '00000000-0000-0000-0000-00000000000c'),
  'answer XP follows the latest outcome of each answer, the teacher''s verdict included');
select pg_temp.assert((select (g -> 'xp' ->> 'exams_submitted')::numeric from t_g) = 30 * (
    select count(*) from public.mock_exams e join public.persons p on p.id = e.person_id
    where p.profile_user_id = '00000000-0000-0000-0000-00000000000c' and e.status in ('submitted', 'graded')),
  'every submitted mock exam gives the approved XP');
select pg_temp.assert((select (g -> 'badges' ->> 'first_answer')::boolean from t_g) = exists (
    select 1 from public.practice_answers pa join public.persons p on p.id = pa.person_id where p.profile_user_id = '00000000-0000-0000-0000-00000000000c'),
  'the first-answer badge follows the student''s answers');
select pg_temp.expect_error($$select public.gamification_overview('00000000-0000-0000-0000-00000000000a', (select v from t_gvalues))$$,
  'FORBIDDEN', 'staff have no XP');
select pg_temp.expect_error($$select public.gamification_overview('00000000-0000-0000-0000-00000000000c', jsonb_set((select v from t_gvalues), '{xp,answer_correct}', '"ten"'))$$,
  'VALIDATION', 'XP values must be numbers from the configuration');

-- 21. Support monitoring (migration 026, PDL-032): pedagogue and psychologist see all students' learning data, notes
-- follow D1 (visibility) and D2 (not the superadministrator), every profile read is audited, readiness follows the scale.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000001f', 'pedagog@test.invalid'),
  ('00000000-0000-0000-0000-00000000002f', 'psiholog@test.invalid');
insert into public.profiles (user_id, username, display_name, role, account_status) values
  ('00000000-0000-0000-0000-00000000001f', 'pedagog@test.invalid', 'Test Pedagogue', 'administrator', 'active'),
  ('00000000-0000-0000-0000-00000000002f', 'psiholog@test.invalid', 'Test Psychologist', 'administrator', 'active');
insert into public.profile_bundles (profile_user_id, bundle_code) values
  ('00000000-0000-0000-0000-00000000001f', 'pedagogue'),
  ('00000000-0000-0000-0000-00000000002f', 'psychologist');
select pg_temp.expect_error($$select public.support_overview('00000000-0000-0000-0000-00000000000c')$$,
  'FORBIDDEN', 'a student cannot open the overview');
select pg_temp.assert(exists (select 1 from jsonb_array_elements(public.support_overview('00000000-0000-0000-0000-00000000001f')) r
  where r ->> 'person_id' = '22222222-2222-2222-2222-22222222222c' and jsonb_array_length(r -> 'subjects') >= 1),
  'the pedagogue sees every student with indicators per subject');
select pg_temp.assert(jsonb_array_length(public.support_overview('00000000-0000-0000-0000-00000000000a')) >= 2,
  'the superadministrator sees the overview');
create temp table t_audit_before as select count(*) as n from public.audit_logs where action = 'support.profile_viewed';
create temp table t_profile as select public.support_student('00000000-0000-0000-0000-00000000001f', '22222222-2222-2222-2222-22222222222c', 5, null) as p;
select pg_temp.assert((select count(*) from public.audit_logs where action = 'support.profile_viewed') = (select n from t_audit_before) + 1,
  'opening a student profile writes an access audit row');
select pg_temp.assert((select (p ->> 'default_visibility') from t_profile) = 'support' and (select (p ->> 'can_write_notes')::boolean from t_profile),
  'the pedagogue writes notes, shared with the psychologist by default (D1)');
select pg_temp.assert(not exists (select 1 from t_profile, jsonb_array_elements(p -> 'subjects') s
  where (s -> 'readiness' ->> 'exams')::integer < 3 and s -> 'readiness' ->> 'state' <> 'not_available'),
  'readiness is not available with fewer than three graded mock exams (PDL-032)');
select pg_temp.assert(private.readiness_state(3, 0) = '100' and private.readiness_state(3, 1) = '90' and private.readiness_state(3, 2) = '90'
  and private.readiness_state(3, 3) = '80' and private.readiness_state(3, 4) = 'below_80' and private.readiness_state(2, 0) = 'not_available',
  'readiness scale: 0 errors 100, 1 to 2 errors 90, 3 errors 80, more below 80, under three exams not available (PDL-032)');
select pg_temp.expect_error($$select public.support_student('00000000-0000-0000-0000-00000000001f', '22222222-2222-2222-2222-22222222222c', 0, null)$$,
  'VALIDATION', 'the mission goal is validated');
select pg_temp.expect_error($$select public.support_student('00000000-0000-0000-0000-00000000001f', gen_random_uuid(), 5, null)$$,
  'NOT_FOUND', 'only students have a support profile');
-- D1: the psychologist's note stays with her by default; the pedagogue's note is shared.
select public.support_note_add('00000000-0000-0000-0000-00000000002f', '22222222-2222-2222-2222-22222222222c', 'student_talk', 'Test: Gespräch', null, null, null);
select public.support_note_add('00000000-0000-0000-0000-00000000001f', '22222222-2222-2222-2222-22222222222c', 'agreement', 'Test: dogovor', current_date + 3, null, null);
select pg_temp.assert((select visibility from public.support_notes where author = '00000000-0000-0000-0000-00000000002f') = 'author'
  and (select visibility from public.support_notes where author = '00000000-0000-0000-0000-00000000001f') = 'support',
  'default visibility: psychologist "samo ja", pedagogue "pedagog i psiholog" (D1)');
select pg_temp.assert(jsonb_array_length(public.support_student('00000000-0000-0000-0000-00000000001f', '22222222-2222-2222-2222-22222222222c', 5, null) -> 'notes') = 1,
  'the pedagogue does not see the psychologist''s private note');
select pg_temp.assert(jsonb_array_length(public.support_student('00000000-0000-0000-0000-00000000002f', '22222222-2222-2222-2222-22222222222c', 5, null) -> 'notes') = 2,
  'the psychologist sees her own note and the shared one');
select pg_temp.assert(jsonb_array_length(public.support_student('00000000-0000-0000-0000-00000000000a', '22222222-2222-2222-2222-22222222222c', 5, null) -> 'notes') = 0
  and not (public.support_student('00000000-0000-0000-0000-00000000000a', '22222222-2222-2222-2222-22222222222c', 5, null) ->> 'can_write_notes')::boolean,
  'the superadministrator reads and writes no support note (D2)');
select pg_temp.expect_error($$select public.support_note_add('00000000-0000-0000-0000-00000000000a', '22222222-2222-2222-2222-22222222222c', null, 'x', null, null, null)$$,
  'FORBIDDEN', 'the superadministrator cannot write a support note (D2)');
select pg_temp.expect_error($$select public.support_note_add('00000000-0000-0000-0000-00000000001f', '22222222-2222-2222-2222-22222222222c', 'diagnosis', 'x', null, null, null)$$,
  'VALIDATION', 'only neutral note types (D3)');
select pg_temp.assert(jsonb_array_length(public.support_follow_ups('00000000-0000-0000-0000-00000000002f')) = 1,
  'shared follow-up dates appear for the other support role');
select pg_temp.assert(not exists (select 1 from public.audit_logs where action = 'support.note_added' and details::text like '%Test:%'),
  'audit rows never carry note content');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000001f', false);
select pg_temp.assert((select count(*) from public.support_notes) = 1, 'RLS: the pedagogue reads only the shared note');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select pg_temp.assert((select count(*) from public.support_notes) = 0, 'RLS: a teacher reads no support note');
reset role;
select pg_temp.assert(not exists (select 1 from pg_tables where schemaname = 'public' and not rowsecurity), 'RLS enabled on every public table after 026');

-- 22. Subject teacher view and daily summary (migration 027, PDL-033): a subject-scoped students.view_progress sees only
-- its subject, never a support note or the all-subject mission; the daily summary follows the same scope.
create temp table t_teacher_subject as select code from public.subjects where id = '11111111-1111-1111-1111-111111111111';
select pg_temp.assert(jsonb_array_length(public.support_overview('00000000-0000-0000-0000-00000000000b')) >= 1
  and not exists (select 1 from jsonb_array_elements(public.support_overview('00000000-0000-0000-0000-00000000000b')) r, jsonb_array_elements(r -> 'subjects') s
                  where s ->> 'code' <> (select code from t_teacher_subject)),
  'the subject teacher sees every student, only in the own subject');
create temp table t_teacher_profile as select public.support_student('00000000-0000-0000-0000-00000000000b', '22222222-2222-2222-2222-22222222222c', 5, null) as p;
select pg_temp.assert((select jsonb_array_length(p -> 'subjects') from t_teacher_profile) = 1
  and (select p -> 'subjects' -> 0 ->> 'code' from t_teacher_profile) = (select code from t_teacher_subject),
  'the teacher''s student profile shows only the own subject');
select pg_temp.assert((select jsonb_array_length(p -> 'notes') = 0 and not (p ->> 'can_write_notes')::boolean and p -> 'missions_30' = 'null'::jsonb from t_teacher_profile),
  'the teacher sees no support note and no all-subject mission count');
select pg_temp.assert((select details ->> 'scope' from public.audit_logs where action = 'support.profile_viewed' and actor_user_id = '00000000-0000-0000-0000-00000000000b' order by id desc limit 1) = 'subject',
  'the teacher''s profile read is audited as a subject-scoped read');
select pg_temp.assert(not exists (select 1 from jsonb_array_elements(public.support_patterns('00000000-0000-0000-0000-00000000000b') -> 'areas') a
                  where a ->> 'subject' <> (select code from t_teacher_subject)),
  'the teacher''s group analysis covers only the own subject');
select pg_temp.expect_error($$select public.daily_summary('00000000-0000-0000-0000-00000000000c', current_date)$$,
  'FORBIDDEN', 'a student has no daily summary');
select pg_temp.expect_error($$select public.daily_summary('00000000-0000-0000-0000-00000000000b', (now() at time zone 'Europe/Sarajevo')::date + 1)$$,
  'VALIDATION', 'the daily summary has no future day');
select pg_temp.expect_error($$select public.daily_summary('00000000-0000-0000-0000-00000000000b', (now() at time zone 'Europe/Sarajevo')::date - 31)$$,
  'VALIDATION', 'the daily summary reaches back 30 days at most');
create temp table t_daily as select public.daily_summary('00000000-0000-0000-0000-00000000000b', (now() at time zone 'Europe/Sarajevo')::date) as d;
select pg_temp.assert((select jsonb_array_length(d -> 'subjects') from t_daily) = 1
  and (select d -> 'subjects' -> 0 ->> 'code' from t_daily) = (select code from t_teacher_subject),
  'the teacher''s daily summary covers only the own subject');
select pg_temp.assert((select count(*) from t_daily, jsonb_array_elements(d -> 'subjects' -> 0 -> 'practised') x where x ->> 'person_id' = '22222222-2222-2222-2222-22222222222c')
  + (select count(*) from t_daily, jsonb_array_elements(d -> 'subjects' -> 0 -> 'not_practised') x where x ->> 'person_id' = '22222222-2222-2222-2222-22222222222c') = 1,
  'every active student is either among those who practised that day or those who did not');
select pg_temp.assert(jsonb_array_length(public.daily_summary('00000000-0000-0000-0000-00000000001f', (now() at time zone 'Europe/Sarajevo')::date) -> 'subjects') = (select count(*) from public.subjects),
  'the pedagogue''s daily summary covers every subject');
