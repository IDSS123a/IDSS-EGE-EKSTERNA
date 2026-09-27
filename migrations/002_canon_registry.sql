-- Migration: 002_canon_registry
-- Date: 2026-09-27
-- Author: ACA (Claude Code)
-- Description: Canonical document registry — types, logical documents and immutable versions
--              (mandate §0, DATA_MODEL.md §2, PDL-004). Schema only in Sprint 01; the upload flow
--              and activate_canon_version() arrive in Sprint 02.
--              Invariant enforced by the database: at most one ACTIVE version per document.
-- Rollback:
--   drop table if exists public.canon_generation, public.canonical_document_versions,
--     public.canonical_documents, public.canonical_document_types cascade;
--   drop type if exists public.canon_version_status;

create type public.canon_version_status as enum
  ('draft', 'processing', 'validation_required', 'active', 'superseded', 'archived', 'rejected');

create table public.canonical_document_types (
  code            text primary key check (code ~ '^[a-z_]+$'),
  name            text not null,
  -- Authority hierarchy of INSTRUCTION §4 (1 = law/regulation … 6 = prototype code).
  authority_level smallint not null check (authority_level between 1 and 6),
  -- What the application may derive from this type (e.g. {"questions": true, "rules": true}).
  capabilities    jsonb not null default '{}'::jsonb
);

create table public.canonical_documents (
  id               uuid primary key default gen_random_uuid(),
  type_code        text not null references public.canonical_document_types (code) on delete restrict,
  -- FK to subjects is added in Sprint 04 (subjects are rows derived from the active rulebook).
  scope_subject_id uuid,
  scope            jsonb not null default '{}'::jsonb,
  title            text not null,
  created_at       timestamptz not null default now()
);

create table public.canonical_document_versions (
  id                       uuid primary key default gen_random_uuid(),
  document_id              uuid not null references public.canonical_documents (id) on delete restrict,
  storage_path             text not null,
  sha256                   text not null unique check (sha256 ~ '^[0-9a-f]{64}$'),
  mime_type                text not null,
  byte_size                bigint not null check (byte_size > 0),
  issuing_authority        text not null,
  official_title           text not null,
  reference_number         text,
  published_on             date,
  effective_from           date,
  revision_label           text,
  status                   public.canon_version_status not null default 'draft',
  uploaded_by              uuid not null references public.profiles (user_id) on delete restrict,
  uploaded_at              timestamptz not null default now(),
  activated_by             uuid references public.profiles (user_id) on delete restrict,
  activated_at             timestamptz,
  superseded_by_version_id uuid references public.canonical_document_versions (id) on delete restrict,
  check ((status = 'active') = (activated_at is not null) or status in ('superseded', 'archived'))
);

-- PDL-004: no application path can leave two active versions of one document.
create unique index canonical_document_versions_one_active
  on public.canonical_document_versions (document_id) where status = 'active';

-- Bumped on every activation; part of every cache key (stale-cache invalidation, mandate §0).
create table public.canon_generation (
  id         boolean primary key default true check (id),
  generation bigint not null default 0,
  bumped_at  timestamptz not null default now()
);
insert into public.canon_generation (id, generation) values (true, 0);

alter table public.canonical_document_types    enable row level security;
alter table public.canonical_documents         enable row level security;
alter table public.canonical_document_versions enable row level security;
alter table public.canon_generation            enable row level security;

-- Metadata of the registry is readable by any active account; content access is decided
-- per derived table later. Writes only through the Superadmin server flow (no write policies).
create policy canonical_document_types_select on public.canonical_document_types
  for select to authenticated using (public.current_account_role() is not null);
create policy canonical_documents_select on public.canonical_documents
  for select to authenticated using (public.current_account_role() is not null);
-- Students never see non-active versions; staff with canon capabilities see the full history.
create policy canonical_document_versions_select_active on public.canonical_document_versions
  for select to authenticated using (status = 'active' and public.current_account_role() is not null);
create policy canonical_document_versions_select_staff on public.canonical_document_versions
  for select to authenticated using (public.has_capability('canon.publish') or public.has_capability('canon.review'));
create policy canon_generation_select on public.canon_generation
  for select to authenticated using (public.current_account_role() is not null);

-- Document types known from the Sprint 00 evidence map (SOURCE_INVENTORY.md §1–2).
insert into public.canonical_document_types (code, name, authority_level, capabilities) values
  ('rulebook',           'Pravilnik / regulation',                         1, '{"rules": true}'),
  ('ministry_instruction','Uputstvo / instrukcija ministarstva',           2, '{"rules": true}'),
  ('official_form',      'Službeni obrazac',                               2, '{"forms": true}'),
  ('subject_catalogue',  'Ispitni katalog predmeta',                       3, '{"questions": true, "answer_keys": true, "rules": true, "competencies": true}'),
  ('official_exam_test', 'Službeni ispitni test',                          4, '{"blueprints": true}'),
  ('official_answer_key','Službeno rješenje testa',                        4, '{"answer_keys": true}'),
  ('idss_material',      'IDSS-odobreni pedagoški materijal',              5, '{"learning_content": true}');
