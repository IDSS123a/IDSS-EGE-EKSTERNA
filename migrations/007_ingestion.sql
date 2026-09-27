-- Migration: 007_ingestion
-- Date: 2026-09-27
-- Author: ACA (Claude Code)
-- Description: Sprint 03 ingestion pipeline (mandate §0 Quality Gate; DATA_MODEL.md §3; PDL-013).
--   * canonical_ingestion_jobs: one row per extraction run of a document version (profile, extractor
--     version, outcome, counts, report). Written once, complete; never updated or deleted.
--   * ingested_records: every extracted catalogue record of a job, always untrusted until the
--     semantic review of Sprint 04. Never updated or deleted (a new run is a new job).
--   * record_ingestion_job(): the only write path. SECURITY INVOKER, service_role only; re-checks the
--     actor's canon.publish capability, writes job, records, dependency map rows and the audit row in
--     one transaction. Records depend on their source version, so superseding the version marks
--     them stale (activate_canon_version, migration 006).
-- Rollback:
--   drop function if exists public.record_ingestion_job(uuid, uuid, jsonb, jsonb, inet);
--   drop table if exists public.ingested_records, public.canonical_ingestion_jobs;
--   drop type if exists public.ingestion_job_state;

create type public.ingestion_job_state as enum ('succeeded', 'failed');

create table public.canonical_ingestion_jobs (
  id                uuid primary key default gen_random_uuid(),
  version_id        uuid not null references public.canonical_document_versions (id) on delete restrict,
  state             public.ingestion_job_state not null,
  profile_code      text,
  profile_version   integer,
  extractor_version text not null,
  page_count        integer check (page_count is null or page_count > 0),
  -- units, scored_units, passed, passed_with_flags, failed, with_answer_key, supplementary
  counts            jsonb not null default '{}'::jsonb,
  -- extractor statistics, flag counts, structural failures, missing keys
  report            jsonb not null default '{}'::jsonb,
  failure_code      text check (failure_code is null or failure_code ~ '^[A-Z_]+$'),
  started_by        uuid not null references public.profiles (user_id) on delete restrict,
  started_at        timestamptz not null,
  finished_at       timestamptz not null default now(),
  check ((state = 'failed') = (failure_code is not null))
);
create index canonical_ingestion_jobs_version_idx on public.canonical_ingestion_jobs (version_id, finished_at desc);
create index canonical_ingestion_jobs_started_by_idx on public.canonical_ingestion_jobs (started_by);

create table public.ingested_records (
  id                bigint generated always as identity primary key,
  job_id            uuid not null references public.canonical_ingestion_jobs (id) on delete restrict,
  version_id        uuid not null references public.canonical_document_versions (id) on delete restrict,
  record_key        text not null check (record_key ~ '^[A-Z]{3}-[A-Z0-9.]+$'),
  record_kind       text not null,
  ordinal           integer not null check (ordinal > 0),
  structural_status text not null check (structural_status in ('passed', 'passed_with_flags', 'failed')),
  -- Nothing extracted is trusted before the semantic/source review (Sprint 04).
  trust_status      text not null default 'untrusted_pending_review' check (trust_status = 'untrusted_pending_review'),
  record            jsonb not null,
  unique (job_id, record_key)
);
create index ingested_records_version_idx on public.ingested_records (version_id);

create trigger canonical_ingestion_jobs_append_only before update or delete on public.canonical_ingestion_jobs
  for each row execute function public.reject_audit_mutation();
create trigger ingested_records_append_only before update or delete on public.ingested_records
  for each row execute function public.reject_audit_mutation();

alter table public.canonical_ingestion_jobs enable row level security;
alter table public.ingested_records         enable row level security;

create policy canonical_ingestion_jobs_select on public.canonical_ingestion_jobs for select to authenticated using (
  private.has_capability('canon.publish') or private.has_capability('canon.review')
);
create policy ingested_records_select on public.ingested_records for select to authenticated using (
  private.has_capability('canon.publish') or private.has_capability('canon.review')
);

-- ---------------------------------------------------------------------------- write path
-- p_job: {state, profile_code, profile_version, extractor_version, page_count, counts, report,
--         failure_code, started_at}; p_records: array of {record_key, record_kind,
--         structural_status, record} in source order (empty for a failed job).
create or replace function public.record_ingestion_job(p_actor uuid, p_version_id uuid, p_job jsonb, p_records jsonb, p_ip inet)
returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  v_status public.canon_version_status;
  v_job_id uuid;
  v_state  public.ingestion_job_state := (p_job ->> 'state')::public.ingestion_job_state;
begin
  if not private.actor_has_capability(p_actor, 'canon.publish') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select status into v_status from public.canonical_document_versions where id = p_version_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  -- Only a version that is (or is about to become) canon is ingested.
  if v_status not in ('active', 'validation_required') then
    raise exception 'INVALID_TRANSITION' using errcode = '22023';
  end if;
  if v_state = 'failed' and jsonb_array_length(coalesce(p_records, '[]'::jsonb)) > 0 then
    raise exception 'VALIDATION' using errcode = '22023';
  end if;

  insert into public.canonical_ingestion_jobs (version_id, state, profile_code, profile_version, extractor_version,
    page_count, counts, report, failure_code, started_by, started_at)
  values (p_version_id, v_state, p_job ->> 'profile_code', (p_job ->> 'profile_version')::integer,
    p_job ->> 'extractor_version', (p_job ->> 'page_count')::integer, coalesce(p_job -> 'counts', '{}'::jsonb),
    coalesce(p_job -> 'report', '{}'::jsonb), p_job ->> 'failure_code', p_actor, (p_job ->> 'started_at')::timestamptz)
  returning id into v_job_id;

  insert into public.ingested_records (job_id, version_id, record_key, record_kind, ordinal, structural_status, record)
  select v_job_id, p_version_id, element ->> 'record_key', element ->> 'record_kind', ordinality::integer,
         element ->> 'structural_status', element -> 'record'
  from jsonb_array_elements(coalesce(p_records, '[]'::jsonb)) with ordinality as rows (element, ordinality);

  -- Dependency map: every record is derived from this source version.
  insert into public.canonical_dependencies (source_version_id, dependent_table, dependent_id)
  select p_version_id, 'ingested_records', id::text from public.ingested_records where job_id = v_job_id;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address)
  values (p_actor, case when v_state = 'succeeded' then 'canon.ingestion_succeeded' else 'canon.ingestion_failed' end,
          'canonical_ingestion_job', v_job_id::text,
          jsonb_build_object('version_id', p_version_id, 'records', jsonb_array_length(coalesce(p_records, '[]'::jsonb)),
                             'failure_code', p_job ->> 'failure_code'), p_ip);
  return v_job_id;
end;
$$;

revoke all on function public.record_ingestion_job(uuid, uuid, jsonb, jsonb, inet) from public, anon, authenticated;
grant execute on function public.record_ingestion_job(uuid, uuid, jsonb, jsonb, inet) to service_role;
