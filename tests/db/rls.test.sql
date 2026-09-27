-- RLS and integrity tests for migrations 001–003. Any failed assertion raises and stops psql
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
select pg_temp.assert((select count(*) from public.canonical_document_versions) = 1, 'student sees only the active version');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select pg_temp.assert((select count(*) from public.canonical_document_versions) = 2, 'superadmin sees full version history');
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
