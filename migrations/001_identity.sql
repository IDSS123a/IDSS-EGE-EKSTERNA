-- Migration: 001_identity
-- Date: 2026-09-27
-- Author: ACA (Claude Code)
-- Description: Accounts, capability-based authorization and longitudinal student identity
--              (docs/architecture/DATA_MODEL.md §1, ROLES_AND_PERMISSIONS.md, mandate §7A).
--              RLS deny-by-default on every table. Writes happen only through server code
--              that has already authenticated + authorised the caller (service role, A-8).
-- Rollback:
--   drop function if exists public.has_capability(text, uuid);
--   drop function if exists public.current_account_role();
--   drop table if exists public.enrolments, public.cohorts, public.school_years, public.persons,
--     public.profile_bundles, public.bundle_capabilities, public.capability_bundles,
--     public.role_capabilities, public.capabilities, public.profiles cascade;
--   drop type if exists public.enrolment_status, public.school_year_status,
--     public.account_status, public.account_role;

-- ---------------------------------------------------------------------------- types
create type public.account_role as enum ('superadmin', 'administrator', 'student');
create type public.account_status as enum ('invited', 'active', 'suspended', 'blocked', 'deactivated', 'archived');
create type public.school_year_status as enum ('planned', 'active', 'closed');
create type public.enrolment_status as enum ('active', 'completed', 'withdrawn', 'exempt');

-- ---------------------------------------------------------------------------- accounts
-- One row per Supabase Auth user. Username is what people type at login (PDL-003):
-- staff = official e-mail, students = school-issued username (no e-mail, AMB-06).
create table public.profiles (
  user_id        uuid primary key references auth.users (id) on delete restrict,
  username       text not null check (length(username) between 3 and 120),
  display_name   text not null check (length(display_name) between 1 and 160),
  role           public.account_role not null,
  account_status public.account_status not null default 'invited',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
-- Case-insensitive uniqueness without the citext extension.
create unique index profiles_username_lower_key on public.profiles (lower(username));

-- ---------------------------------------------------------------------------- capabilities
-- Fine-grained permissions (ROLES_AND_PERMISSIONS.md §2). Data, not code, so the
-- Superadmin can adjust grants without a deployment.
create table public.capabilities (
  code        text primary key check (code ~ '^[a-z_]+\.[a-z_]+$'),
  description text not null
);

create table public.role_capabilities (
  role            public.account_role not null,
  capability_code text not null references public.capabilities (code) on delete restrict,
  primary key (role, capability_code)
);

-- Named bundles for administrators (subject teacher, pedagogue, psychologist, admin operations).
create table public.capability_bundles (
  code        text primary key check (code ~ '^[a-z_]+$'),
  description text not null
);

create table public.bundle_capabilities (
  bundle_code     text not null references public.capability_bundles (code) on delete restrict,
  capability_code text not null references public.capabilities (code) on delete restrict,
  primary key (bundle_code, capability_code)
);

-- A bundle granted to one account; scope_subject_id narrows it to one exam subject
-- (FK to subjects is added when canon-derived subjects exist — Sprint 04).
create table public.profile_bundles (
  id               uuid primary key default gen_random_uuid(),
  profile_user_id  uuid not null references public.profiles (user_id) on delete restrict,
  bundle_code      text not null references public.capability_bundles (code) on delete restrict,
  scope_subject_id uuid,
  granted_by       uuid references public.profiles (user_id) on delete restrict,
  granted_at       timestamptz not null default now()
);
create unique index profile_bundles_unique_grant
  on public.profile_bundles (profile_user_id, bundle_code, coalesce(scope_subject_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- ---------------------------------------------------------------------------- longitudinal identity
-- A person outlives accounts and school years (mandate §7A.4): history references person_id.
create table public.persons (
  id              uuid primary key default gen_random_uuid(),
  profile_user_id uuid unique references public.profiles (user_id) on delete restrict,
  created_at      timestamptz not null default now()
);

create table public.school_years (
  id        uuid primary key default gen_random_uuid(),
  label     text not null unique check (label ~ '^\d{4}/\d{2,4}$'),
  starts_on date not null,
  ends_on   date not null,
  status    public.school_year_status not null default 'planned',
  check (ends_on > starts_on)
);

create table public.cohorts (
  id             uuid primary key default gen_random_uuid(),
  school_year_id uuid not null references public.school_years (id) on delete restrict,
  label          text not null,
  unique (school_year_id, label)
);

create table public.enrolments (
  id                                uuid primary key default gen_random_uuid(),
  person_id                         uuid not null references public.persons (id) on delete restrict,
  cohort_id                         uuid not null references public.cohorts (id) on delete restrict,
  class_label                       text,
  status                            public.enrolment_status not null default 'active',
  -- Subject (c) of Pravilnik Art. 5; German for every IDSS student (AMB-03). FK in Sprint 04.
  first_foreign_language_subject_id uuid,
  created_at                        timestamptz not null default now(),
  unique (person_id, cohort_id)
);

-- ---------------------------------------------------------------------------- authorization functions
-- Role of the calling user, resolved from the database on every call (never from JWT claims, E-4).
create or replace function public.current_account_role()
returns public.account_role
language sql stable security definer set search_path = ''
as $$
  select p.role from public.profiles p
  where p.user_id = auth.uid() and p.account_status = 'active'
$$;

-- True when the calling, *active* account holds the capability through its role or a bundle.
-- A bundle scoped to a subject only satisfies checks for that subject (or unscoped checks).
create or replace function public.has_capability(capability text, subject_id uuid default null)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.role_capabilities rc on rc.role = p.role
    where p.user_id = auth.uid() and p.account_status = 'active' and rc.capability_code = capability
  ) or exists (
    select 1
    from public.profiles p
    join public.profile_bundles pb on pb.profile_user_id = p.user_id
    join public.bundle_capabilities bc on bc.bundle_code = pb.bundle_code
    where p.user_id = auth.uid() and p.account_status = 'active' and bc.capability_code = capability
      and (pb.scope_subject_id is null or subject_id is null or pb.scope_subject_id = subject_id)
  )
$$;

revoke all on function public.current_account_role() from public;
revoke all on function public.has_capability(text, uuid) from public;
grant execute on function public.current_account_role() to authenticated;
grant execute on function public.has_capability(text, uuid) to authenticated;

-- ---------------------------------------------------------------------------- row level security
alter table public.profiles            enable row level security;
alter table public.capabilities        enable row level security;
alter table public.role_capabilities   enable row level security;
alter table public.capability_bundles  enable row level security;
alter table public.bundle_capabilities enable row level security;
alter table public.profile_bundles     enable row level security;
alter table public.persons             enable row level security;
alter table public.school_years        enable row level security;
alter table public.cohorts             enable row level security;
alter table public.enrolments          enable row level security;

-- No INSERT/UPDATE/DELETE policies anywhere: clients cannot write; the server writes after
-- its own authentication + authorisation checks (E-6), so a self-update of role/status is impossible.

create policy profiles_select_own on public.profiles
  for select to authenticated using (user_id = auth.uid());
create policy profiles_select_managers on public.profiles
  for select to authenticated using (public.has_capability('accounts.view') or public.has_capability('accounts.manage'));

create policy capabilities_select on public.capabilities for select to authenticated using (true);
create policy role_capabilities_select on public.role_capabilities for select to authenticated using (true);
create policy capability_bundles_select on public.capability_bundles for select to authenticated using (true);
create policy bundle_capabilities_select on public.bundle_capabilities for select to authenticated using (true);

create policy profile_bundles_select_own on public.profile_bundles
  for select to authenticated using (profile_user_id = auth.uid());
create policy profile_bundles_select_managers on public.profile_bundles
  for select to authenticated using (public.has_capability('accounts.manage'));

create policy persons_select_own on public.persons
  for select to authenticated using (profile_user_id = auth.uid());
create policy persons_select_staff on public.persons
  for select to authenticated using (public.has_capability('students.view_progress') or public.has_capability('cohorts.manage'));

create policy school_years_select on public.school_years
  for select to authenticated using (public.current_account_role() is not null);
create policy cohorts_select on public.cohorts
  for select to authenticated using (public.current_account_role() is not null);

create policy enrolments_select_own on public.enrolments
  for select to authenticated using (
    exists (select 1 from public.persons pe where pe.id = person_id and pe.profile_user_id = auth.uid())
  );
create policy enrolments_select_staff on public.enrolments
  for select to authenticated using (public.has_capability('students.view_progress') or public.has_capability('cohorts.manage'));

-- ---------------------------------------------------------------------------- seed: capabilities
insert into public.capabilities (code, description) values
  ('accounts.manage',            'Create, activate, suspend, block, deactivate and archive accounts; manage grants'),
  ('accounts.view',              'View account list and account status'),
  ('accounts.reset_password',    'Reset a student password (audited, PDL-003)'),
  ('cohorts.manage',             'Manage school years, cohorts and enrolments'),
  ('canon.publish',              'Upload, activate, supersede and roll back canonical document versions'),
  ('canon.review',               'Review ingested canonical records (semantic/source gate)'),
  ('answer_keys.propose_revision','Propose a reviewed answer-key correction'),
  ('students.view_progress',     'View individual student academic progress'),
  ('assignments.manage',         'Assign practice and missions'),
  ('teacher_notes.read_write',   'Read and write academic teacher notes'),
  ('support_notes.read_write',   'Read and write pedagogical/psychological support notes'),
  ('analytics.view_institution', 'Institution-wide analytics'),
  ('analytics.view_aggregate',   'Aggregate (non-individual) analytics'),
  ('audit.view',                 'View audit log and security events'),
  ('reports.export',             'Export permitted reports'),
  ('practice.participate',       'Practise, take mock exams, missions and achievements');

-- Superadmin: everything except support notes (default denied pending institutional policy,
-- ROLES_AND_PERMISSIONS.md §3) and student practice.
insert into public.role_capabilities (role, capability_code)
select 'superadmin', code from public.capabilities
where code not in ('support_notes.read_write', 'practice.participate');

insert into public.role_capabilities (role, capability_code) values ('student', 'practice.participate');

insert into public.capability_bundles (code, description) values
  ('subject_teacher',  'Subject teacher (scoped to one exam subject)'),
  ('pedagogue',        'Pedagogue — student support and school-level monitoring'),
  ('psychologist',     'Psychologist — student support within the privacy boundary'),
  ('admin_operations', 'Authorised administrative operations (Sprint 01: account viewing only)');

insert into public.bundle_capabilities (bundle_code, capability_code) values
  ('subject_teacher', 'canon.review'),
  ('subject_teacher', 'answer_keys.propose_revision'),
  ('subject_teacher', 'students.view_progress'),
  ('subject_teacher', 'assignments.manage'),
  ('subject_teacher', 'teacher_notes.read_write'),
  ('subject_teacher', 'analytics.view_aggregate'),
  ('subject_teacher', 'reports.export'),
  ('pedagogue', 'students.view_progress'),
  ('pedagogue', 'teacher_notes.read_write'),
  ('pedagogue', 'support_notes.read_write'),
  ('pedagogue', 'analytics.view_aggregate'),
  ('pedagogue', 'reports.export'),
  ('psychologist', 'students.view_progress'),
  ('psychologist', 'teacher_notes.read_write'),
  ('psychologist', 'support_notes.read_write'),
  ('psychologist', 'analytics.view_aggregate'),
  ('psychologist', 'reports.export'),
  ('admin_operations', 'accounts.view');
