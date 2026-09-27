-- Migration: 006_canon_lifecycle
-- Date: 2026-09-27
-- Author: ACA (Claude Code)
-- Description: Sprint 02 canon registry lifecycle (mandate §0, §4; DATA_MODEL.md §2; PDL-004).
--   * private storage bucket for canonical source files (PDF only, size-limited)
--   * canonical_version_events: append-only lifecycle history of every version
--   * canonical_dependencies: derived object -> source version (dependency map; filled from Sprint 03)
--   * register_canon_version / activate_canon_version / set_canon_version_status:
--     the ONLY write paths of the registry. Each runs in one transaction, re-checks the actor's
--     capability, validates the transition, writes the history event and the audit row.
--     SECURITY INVOKER and executable by service_role only: the server action authenticates the
--     caller, checks the capability, then calls the function with the verified actor id, which the
--     function checks again (defence in depth). No SECURITY DEFINER in the exposed schema (lesson 004).
--   Invariants: at most one active version per document (partial unique index from 002);
--   nothing is ever deleted (versions, events and audit rows have no delete path).
-- Rollback:
--   drop function if exists public.register_canon_version, public.activate_canon_version,
--     public.set_canon_version_status, private.actor_has_capability;
--   drop table if exists public.canonical_dependencies, public.canonical_version_events;
--   delete from storage.buckets where id = 'canon-documents';  -- only while the bucket is empty

-- ---------------------------------------------------------------------------- storage
-- Private: files are only reachable through short-lived signed URLs created by the server
-- after a capability check. 50 MB = Supabase project upload limit.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('canon-documents', 'canon-documents', false, 52428800, array['application/pdf'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------- history
create table public.canonical_version_events (
  id            bigint generated always as identity primary key,
  version_id    uuid not null references public.canonical_document_versions (id) on delete restrict,
  document_id   uuid not null references public.canonical_documents (id) on delete restrict,
  event         text not null check (event in ('uploaded', 'activated', 'rolled_back', 'superseded', 'rejected', 'archived')),
  from_status   public.canon_version_status,
  to_status     public.canon_version_status not null,
  actor_user_id uuid not null references public.profiles (user_id) on delete restrict,
  reason        text check (reason is null or char_length(reason) between 1 and 500),
  generation    bigint,
  occurred_at   timestamptz not null default now()
);
create index canonical_version_events_document_idx on public.canonical_version_events (document_id, occurred_at desc);
create index canonical_version_events_version_idx on public.canonical_version_events (version_id);
create index canonical_version_events_actor_idx on public.canonical_version_events (actor_user_id);
create trigger canonical_version_events_append_only before update or delete on public.canonical_version_events
  for each row execute function public.reject_audit_mutation();

-- ---------------------------------------------------------------------------- dependency map
create table public.canonical_dependencies (
  id                bigint generated always as identity primary key,
  source_version_id uuid not null references public.canonical_document_versions (id) on delete restrict,
  dependent_table   text not null check (dependent_table ~ '^[a-z_]+$'),
  dependent_id      text not null,
  state             text not null default 'current' check (state in ('current', 'stale', 'rebuilt')),
  created_at        timestamptz not null default now(),
  unique (source_version_id, dependent_table, dependent_id)
);
create index canonical_dependencies_source_idx on public.canonical_dependencies (source_version_id, state);

alter table public.canonical_version_events enable row level security;
alter table public.canonical_dependencies   enable row level security;

create policy canonical_version_events_select on public.canonical_version_events for select to authenticated using (
  private.has_capability('canon.publish') or private.has_capability('canon.review')
);
create policy canonical_dependencies_select on public.canonical_dependencies for select to authenticated using (
  private.has_capability('canon.publish') or private.has_capability('canon.review')
);

-- ---------------------------------------------------------------------------- actor check
-- Same rule as private.has_capability, for an explicit (server-verified) actor instead of auth.uid().
create or replace function private.actor_has_capability(actor uuid, capability text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    join public.role_capabilities rc on rc.role = p.role
    where p.user_id = actor and p.account_status = 'active' and rc.capability_code = capability
  ) or exists (
    select 1 from public.profiles p
    join public.profile_bundles pb on pb.profile_user_id = p.user_id
    join public.bundle_capabilities bc on bc.bundle_code = pb.bundle_code
    where p.user_id = actor and p.account_status = 'active' and bc.capability_code = capability
  )
$$;
revoke all on function private.actor_has_capability(uuid, text) from public, anon, authenticated;
grant execute on function private.actor_has_capability(uuid, text) to service_role;

-- ---------------------------------------------------------------------------- register
-- New version of a new document (p_document_id null) or of an existing one. The file is
-- already in storage; its SHA-256 is unique across the registry. Status: validation_required.
create or replace function public.register_canon_version(
  p_actor             uuid,
  p_document_id       uuid,
  p_type_code         text,
  p_document_title    text,
  p_scope             jsonb,
  p_version_id        uuid,
  p_storage_path      text,
  p_sha256            text,
  p_mime_type         text,
  p_byte_size         bigint,
  p_issuing_authority text,
  p_official_title    text,
  p_reference_number  text,
  p_published_on      date,
  p_effective_from    date,
  p_revision_label    text,
  p_ip                inet
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_document_id uuid := p_document_id;
begin
  if not private.actor_has_capability(p_actor, 'canon.publish') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if exists (select 1 from public.canonical_document_versions where sha256 = p_sha256) then
    raise exception 'DUPLICATE_FILE' using errcode = '23505';
  end if;

  if v_document_id is null then
    insert into public.canonical_documents (type_code, scope, title)
    values (p_type_code, coalesce(p_scope, '{}'::jsonb), p_document_title)
    returning id into v_document_id;
  elsif not exists (select 1 from public.canonical_documents where id = v_document_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;

  insert into public.canonical_document_versions (
    id, document_id, storage_path, sha256, mime_type, byte_size, issuing_authority, official_title,
    reference_number, published_on, effective_from, revision_label, status, uploaded_by)
  values (
    p_version_id, v_document_id, p_storage_path, p_sha256, p_mime_type, p_byte_size, p_issuing_authority, p_official_title,
    p_reference_number, p_published_on, p_effective_from, p_revision_label, 'validation_required', p_actor);

  insert into public.canonical_version_events (version_id, document_id, event, from_status, to_status, actor_user_id)
  values (p_version_id, v_document_id, 'uploaded', null, 'validation_required', p_actor);

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address)
  values (p_actor, 'canon.version_uploaded', 'canonical_document_version', p_version_id::text,
          jsonb_build_object('document_id', v_document_id, 'sha256', p_sha256, 'byte_size', p_byte_size), p_ip);

  return jsonb_build_object('document_id', v_document_id, 'version_id', p_version_id);
end;
$$;

-- ---------------------------------------------------------------------------- activate / roll back
-- Activates a version awaiting validation, or re-activates a superseded one (rollback).
-- The previously active version of the same document becomes superseded. Bumps canon_generation.
create or replace function public.activate_canon_version(p_actor uuid, p_version_id uuid, p_reason text, p_ip inet)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_target     public.canonical_document_versions%rowtype;
  v_previous   uuid;
  v_generation bigint;
  v_event      text;
begin
  if not private.actor_has_capability(p_actor, 'canon.publish') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select * into v_target from public.canonical_document_versions where id = p_version_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_target.status not in ('validation_required', 'superseded') then
    raise exception 'INVALID_TRANSITION' using errcode = '22023';
  end if;
  v_event := case when v_target.status = 'superseded' then 'rolled_back' else 'activated' end;
  if v_event = 'rolled_back' and nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'REASON_REQUIRED' using errcode = '22023';
  end if;

  -- Serialise activations of one document.
  perform 1 from public.canonical_documents where id = v_target.document_id for update;

  update public.canonical_document_versions
     set status = 'superseded', superseded_by_version_id = v_target.id
   where document_id = v_target.document_id and status = 'active'
  returning id into v_previous;

  update public.canonical_document_versions
     set status = 'active', activated_by = p_actor, activated_at = now(), superseded_by_version_id = null
   where id = v_target.id;

  update public.canon_generation set generation = generation + 1, bumped_at = now() where id
  returning generation into v_generation;

  if v_previous is not null then
    insert into public.canonical_version_events (version_id, document_id, event, from_status, to_status, actor_user_id, reason, generation)
    values (v_previous, v_target.document_id, 'superseded', 'active', 'superseded', p_actor, nullif(btrim(p_reason), ''), v_generation);
    -- Everything derived from the superseded version is stale until rebuilt (mandate §0).
    update public.canonical_dependencies set state = 'stale' where source_version_id = v_previous and state <> 'stale';
  end if;
  insert into public.canonical_version_events (version_id, document_id, event, from_status, to_status, actor_user_id, reason, generation)
  values (v_target.id, v_target.document_id, v_event, v_target.status, 'active', p_actor, nullif(btrim(p_reason), ''), v_generation);

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address)
  values (p_actor, 'canon.version_' || v_event, 'canonical_document_version', v_target.id::text,
          jsonb_build_object('document_id', v_target.document_id, 'previous_version_id', v_previous, 'generation', v_generation), p_ip);

  return jsonb_build_object('version_id', v_target.id, 'previous_version_id', v_previous, 'generation', v_generation, 'event', v_event);
end;
$$;

-- ---------------------------------------------------------------------------- reject / archive
-- validation_required -> rejected; superseded -> archived. Both need a reason. The active
-- version can only leave that state by activating another version (never left without one).
create or replace function public.set_canon_version_status(p_actor uuid, p_version_id uuid, p_status public.canon_version_status, p_reason text, p_ip inet)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_target public.canonical_document_versions%rowtype;
  v_event  text;
begin
  if not private.actor_has_capability(p_actor, 'canon.publish') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'REASON_REQUIRED' using errcode = '22023';
  end if;
  select * into v_target from public.canonical_document_versions where id = p_version_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if (p_status = 'rejected' and v_target.status = 'validation_required') then
    v_event := 'rejected';
  elsif (p_status = 'archived' and v_target.status = 'superseded') then
    v_event := 'archived';
  else
    raise exception 'INVALID_TRANSITION' using errcode = '22023';
  end if;

  update public.canonical_document_versions set status = p_status where id = v_target.id;
  insert into public.canonical_version_events (version_id, document_id, event, from_status, to_status, actor_user_id, reason)
  values (v_target.id, v_target.document_id, v_event, v_target.status, p_status, p_actor, btrim(p_reason));
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address)
  values (p_actor, 'canon.version_' || v_event, 'canonical_document_version', v_target.id::text,
          jsonb_build_object('document_id', v_target.document_id), p_ip);
  return jsonb_build_object('version_id', v_target.id, 'status', p_status);
end;
$$;

-- Only the server (service role) may call the write paths; never anon/authenticated (advisor-clean).
revoke all on function public.register_canon_version(uuid, uuid, text, text, jsonb, uuid, text, text, text, bigint, text, text, text, date, date, text, inet) from public, anon, authenticated;
revoke all on function public.activate_canon_version(uuid, uuid, text, inet) from public, anon, authenticated;
revoke all on function public.set_canon_version_status(uuid, uuid, public.canon_version_status, text, inet) from public, anon, authenticated;
grant execute on function public.register_canon_version(uuid, uuid, text, text, jsonb, uuid, text, text, text, bigint, text, text, text, date, date, text, inet) to service_role;
grant execute on function public.activate_canon_version(uuid, uuid, text, inet) to service_role;
grant execute on function public.set_canon_version_status(uuid, uuid, public.canon_version_status, text, inet) to service_role;
