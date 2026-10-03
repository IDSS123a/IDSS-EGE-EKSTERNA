-- Migration: 020_canon_fidelity
-- Date: 2026-10-03
-- Author: ACA (Claude Code)
-- Description: The catalogue is canon (P-15, PDL-027; Director 2026-10-03). Part 1 of 3 (021, 022 follow).
--   * Printed key only: private.effective_key returns the printed key; key revisions (CF-03) and text revisions
--     (PDL-021) stay as history but no longer change what students see or how answers are checked.
--   * catalogue_errata: an established catalogue error (question, optional item, description, page evidence, the
--     confirming reviewer). It changes nothing; question payloads carry it so every screen shows a notice. Students see
--     that an erratum exists before answering and its description only after answering (or after the result is
--     released), so the notice never gives the answer away. A later row can withdraw an erratum. Append-only.
--   * canon_follow_ups: a question accepted provisionally carries an open follow-up naming who must still review it
--     before it is official (Director: DEU-4.4.10 and 4.5.6 to 4.5.10, Nikolina Todorović); resolved by a later row.
--   * Question payload: base text only (no text revisions), the catalogue SHA-256 for the page crop, errata, choices
--     numbered 1) 2) 3) where the printed key is a number (German dialogue tasks 4.5.6 to 4.5.10).
--   All write paths are SECURITY INVOKER functions, service_role only, re-checking capabilities; every write audited.
-- Rollback:
--   re-apply private.effective_key and private.practice_question (018) and private.choice_label (017);
--   drop function if exists public.record_catalogue_erratum(uuid, uuid, integer, text, text, inet),
--     public.withdraw_catalogue_erratum(uuid, uuid, text, inet), public.open_canon_follow_up(uuid, uuid, text, text, inet),
--     public.resolve_canon_follow_up(uuid, uuid, text, inet), private.question_errata(uuid, boolean);
--   drop table if exists public.canon_follow_up_resolutions, public.canon_follow_ups, public.catalogue_errata;

-- ---------------------------------------------------------------------------- printed key only
create or replace function private.effective_key(p_answer_key_id uuid)
returns text
language sql stable set search_path = ''
as $$
  -- P-15: the printed official key is always the key. Revisions are history only (PDL-027).
  select k.printed_answer from public.answer_keys k where k.id = p_answer_key_id
$$;

-- Option label of a key: "c)", "c", "b)\nSREDNJI NIVO" give c/b; "3" gives 3 (German dialogue tasks numbered 1) 2) 3)).
create or replace function private.choice_label(value text)
returns text
language sql immutable parallel safe set search_path = ''
as $$
  select lower((regexp_match(btrim(coalesce(value, '')), '^([a-eA-E1-5])\)?(\s|$)'))[1])
$$;

-- ---------------------------------------------------------------------------- errata
create table public.catalogue_errata (
  id                  uuid primary key default gen_random_uuid(),
  question_version_id uuid not null references public.question_versions (id) on delete restrict,
  subject_id          uuid not null references public.subjects (id) on delete restrict,
  item_number         integer,
  description         text not null check (length(btrim(description)) between 1 and 2000),
  evidence            text not null check (length(btrim(evidence)) between 1 and 2000),
  withdraws           uuid references public.catalogue_errata (id) on delete restrict,
  recorded_by         uuid not null references public.profiles (user_id) on delete restrict,
  recorded_at         timestamptz not null default now()
);
create index catalogue_errata_question_idx on public.catalogue_errata (question_version_id);
create index catalogue_errata_subject_idx on public.catalogue_errata (subject_id);
create index catalogue_errata_withdraws_idx on public.catalogue_errata (withdraws);
create index catalogue_errata_recorded_by_idx on public.catalogue_errata (recorded_by);
create trigger catalogue_errata_append_only before update or delete on public.catalogue_errata
  for each row execute function public.reject_audit_mutation();
alter table public.catalogue_errata enable row level security;
create policy catalogue_errata_select on public.catalogue_errata for select to authenticated using (
  private.has_capability('canon.publish') or private.has_capability('canon.review', subject_id) or private.has_capability('exams.grade', subject_id));

-- Active errata of a question (not withdrawn). p_full: with description and evidence (staff, or after answering).
create or replace function private.question_errata(p_version_id uuid, p_full boolean)
returns jsonb
language sql stable set search_path = ''
as $$
  select coalesce(jsonb_agg(case when p_full
           then jsonb_build_object('id', e.id, 'item', e.item_number, 'description', e.description, 'evidence', e.evidence, 'recorded_at', e.recorded_at)
           else jsonb_build_object('item', e.item_number) end
         order by e.item_number nulls first, e.recorded_at), '[]'::jsonb)
  from public.catalogue_errata e
  where e.question_version_id = p_version_id and e.withdraws is null
    and not exists (select 1 from public.catalogue_errata w where w.withdraws = e.id)
$$;
revoke all on function private.question_errata(uuid, boolean) from public, anon, authenticated;
grant execute on function private.question_errata(uuid, boolean) to service_role;

create or replace function public.record_catalogue_erratum(p_actor uuid, p_question_version_id uuid, p_item integer, p_description text, p_evidence text, p_ip inet)
returns uuid
language plpgsql set search_path = ''
as $$
declare
  v_version public.question_versions%rowtype;
  v_id      uuid;
begin
  select * into v_version from public.question_versions where id = p_question_version_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if not private.actor_has_subject_capability(p_actor, 'canon.review', v_version.subject_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_description, ''))) not between 1 and 2000 or length(btrim(coalesce(p_evidence, ''))) not between 1 and 2000
     or (p_item is not null and not exists (select 1 from public.answer_keys k where k.question_version_id = v_version.id and k.item_number = p_item)) then
    raise exception 'VALIDATION' using errcode = '22023';
  end if;
  insert into public.catalogue_errata (question_version_id, subject_id, item_number, description, evidence, recorded_by)
  values (v_version.id, v_version.subject_id, p_item, btrim(p_description), btrim(p_evidence), p_actor) returning id into v_id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address)
  values (p_actor, 'canon.erratum_recorded', 'question_versions', v_version.id::text, jsonb_build_object('erratum', v_id, 'item', p_item), p_ip);
  return v_id;
end;
$$;
revoke all on function public.record_catalogue_erratum(uuid, uuid, integer, text, text, inet) from public, anon, authenticated;
grant execute on function public.record_catalogue_erratum(uuid, uuid, integer, text, text, inet) to service_role;

create or replace function public.withdraw_catalogue_erratum(p_actor uuid, p_erratum_id uuid, p_reason text, p_ip inet)
returns uuid
language plpgsql set search_path = ''
as $$
declare
  v_erratum public.catalogue_errata%rowtype;
  v_id      uuid;
begin
  select * into v_erratum from public.catalogue_errata where id = p_erratum_id and withdraws is null;
  if not found or exists (select 1 from public.catalogue_errata where withdraws = p_erratum_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if not private.actor_has_subject_capability(p_actor, 'canon.review', v_erratum.subject_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_reason, ''))) not between 1 and 2000 then
    raise exception 'VALIDATION' using errcode = '22023';
  end if;
  insert into public.catalogue_errata (question_version_id, subject_id, item_number, description, evidence, withdraws, recorded_by)
  values (v_erratum.question_version_id, v_erratum.subject_id, v_erratum.item_number, btrim(p_reason), v_erratum.evidence, v_erratum.id, p_actor)
  returning id into v_id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address)
  values (p_actor, 'canon.erratum_withdrawn', 'question_versions', v_erratum.question_version_id::text, jsonb_build_object('erratum', v_erratum.id), p_ip);
  return v_id;
end;
$$;
revoke all on function public.withdraw_catalogue_erratum(uuid, uuid, text, inet) from public, anon, authenticated;
grant execute on function public.withdraw_catalogue_erratum(uuid, uuid, text, inet) to service_role;

-- ---------------------------------------------------------------------------- follow-ups (provisional acceptance)
create table public.canon_follow_ups (
  id                  uuid primary key default gen_random_uuid(),
  question_version_id uuid not null references public.question_versions (id) on delete restrict,
  subject_id          uuid not null references public.subjects (id) on delete restrict,
  assignee            text not null check (length(btrim(assignee)) between 1 and 200),
  note                text not null check (length(btrim(note)) between 1 and 2000),
  opened_by           uuid not null references public.profiles (user_id) on delete restrict,
  opened_at           timestamptz not null default now()
);
create table public.canon_follow_up_resolutions (
  follow_up_id uuid primary key references public.canon_follow_ups (id) on delete restrict,
  subject_id   uuid not null references public.subjects (id) on delete restrict,
  note         text not null check (length(btrim(note)) between 1 and 2000),
  resolved_by  uuid not null references public.profiles (user_id) on delete restrict,
  resolved_at  timestamptz not null default now()
);
create index canon_follow_ups_question_idx on public.canon_follow_ups (question_version_id);
create index canon_follow_ups_subject_idx on public.canon_follow_ups (subject_id);
create index canon_follow_ups_opened_by_idx on public.canon_follow_ups (opened_by);
create index canon_follow_up_resolutions_subject_idx on public.canon_follow_up_resolutions (subject_id);
create index canon_follow_up_resolutions_resolved_by_idx on public.canon_follow_up_resolutions (resolved_by);
create trigger canon_follow_ups_append_only before update or delete on public.canon_follow_ups
  for each row execute function public.reject_audit_mutation();
create trigger canon_follow_up_resolutions_append_only before update or delete on public.canon_follow_up_resolutions
  for each row execute function public.reject_audit_mutation();
alter table public.canon_follow_ups enable row level security;
alter table public.canon_follow_up_resolutions enable row level security;
create policy canon_follow_ups_select on public.canon_follow_ups for select to authenticated using (
  private.has_capability('canon.publish') or private.has_capability('canon.review', subject_id) or private.has_capability('exams.grade', subject_id));
create policy canon_follow_up_resolutions_select on public.canon_follow_up_resolutions for select to authenticated using (
  private.has_capability('canon.publish') or private.has_capability('canon.review', subject_id) or private.has_capability('exams.grade', subject_id));

create or replace function public.open_canon_follow_up(p_actor uuid, p_question_version_id uuid, p_assignee text, p_note text, p_ip inet)
returns uuid
language plpgsql set search_path = ''
as $$
declare
  v_subject uuid;
  v_id      uuid;
begin
  select subject_id into v_subject from public.question_versions where id = p_question_version_id;
  if v_subject is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if not private.actor_has_subject_capability(p_actor, 'canon.review', v_subject) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_assignee, ''))) not between 1 and 200 or length(btrim(coalesce(p_note, ''))) not between 1 and 2000 then
    raise exception 'VALIDATION' using errcode = '22023';
  end if;
  insert into public.canon_follow_ups (question_version_id, subject_id, assignee, note, opened_by)
  values (p_question_version_id, v_subject, btrim(p_assignee), btrim(p_note), p_actor) returning id into v_id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address)
  values (p_actor, 'canon.follow_up_opened', 'question_versions', p_question_version_id::text, jsonb_build_object('follow_up', v_id), p_ip);
  return v_id;
end;
$$;
revoke all on function public.open_canon_follow_up(uuid, uuid, text, text, inet) from public, anon, authenticated;
grant execute on function public.open_canon_follow_up(uuid, uuid, text, text, inet) to service_role;

create or replace function public.resolve_canon_follow_up(p_actor uuid, p_follow_up_id uuid, p_note text, p_ip inet)
returns void
language plpgsql set search_path = ''
as $$
declare
  v_follow_up public.canon_follow_ups%rowtype;
begin
  select * into v_follow_up from public.canon_follow_ups where id = p_follow_up_id;
  if not found or exists (select 1 from public.canon_follow_up_resolutions where follow_up_id = p_follow_up_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if not private.actor_has_subject_capability(p_actor, 'canon.review', v_follow_up.subject_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_note, ''))) not between 1 and 2000 then
    raise exception 'VALIDATION' using errcode = '22023';
  end if;
  insert into public.canon_follow_up_resolutions (follow_up_id, subject_id, note, resolved_by)
  values (v_follow_up.id, v_follow_up.subject_id, btrim(p_note), p_actor);
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address)
  values (p_actor, 'canon.follow_up_resolved', 'question_versions', v_follow_up.question_version_id::text, jsonb_build_object('follow_up', v_follow_up.id), p_ip);
end;
$$;
revoke all on function public.resolve_canon_follow_up(uuid, uuid, text, inet) from public, anon, authenticated;
grant execute on function public.resolve_canon_follow_up(uuid, uuid, text, inet) to service_role;

-- ---------------------------------------------------------------------------- question payload
-- What a reader sees of a trusted question: the printed text (no revisions; the screen shows the page crop, P-15),
-- per item how to answer, the catalogue SHA-256 for the crop, errata (existence only; descriptions are added by the
-- callers once the student has answered), open follow-ups are staff information and not part of this payload.
create or replace function private.practice_question(p_version_id uuid)
returns jsonb
language plpgsql stable set search_path = ''
as $$
declare
  v_version  public.question_versions%rowtype;
  v_items    jsonb;
  v_question jsonb;
  v_numbered jsonb;
begin
  select * into v_version from public.question_versions where id = p_version_id;
  if not found then
    return null;
  end if;
  -- Options numbered 1) 2) 3) in the printed task (German dialogue tasks), used when the printed key is a number.
  select jsonb_agg(distinct m[2]) into v_numbered from regexp_matches(v_version.raw_text, '(^|\n)\s*([1-5])\)', 'g') as m;

  if jsonb_array_length(v_version.scored_items) > 0 then
    select coalesce(jsonb_agg(jsonb_build_object(
             'item', (item ->> 'item_number')::integer,
             'text', item ->> 'raw_text',
             'mode', case
               when v_version.task_type = 'true_false' and lower(btrim(private.effective_key(k.id))) in ('r', 'f') then 'true_false'
               when v_version.task_type = 'multiple_choice_single_answer' and private.choice_label(private.effective_key(k.id)) ~ '^[a-e]$'
                    and (exists (select 1 from regexp_matches(item ->> 'raw_text', '(^|\n)\s*([a-e])\)', 'g'))
                         or jsonb_array_length(v_version.options) > 0) then 'choice'
               when v_version.task_type = 'multiple_choice_single_answer' and private.choice_label(private.effective_key(k.id)) ~ '^[1-5]$'
                    and v_numbered is not null then 'choice'
               else 'open' end,
             'choices', case
               when private.choice_label(private.effective_key(k.id)) ~ '^[1-5]$' and v_numbered is not null then v_numbered
               else coalesce(
                 (select jsonb_agg(distinct m[2]) from regexp_matches(item ->> 'raw_text', '(^|\n)\s*([a-e])\)', 'g') as m),
                 (select coalesce(jsonb_agg(lower(o ->> 'label') order by n), '[]'::jsonb) from jsonb_array_elements(v_version.options) with ordinality as x (o, n)))
               end)
           order by (item ->> 'item_number')::integer), '[]'::jsonb)
    into v_items
    from jsonb_array_elements(v_version.scored_items) item
    left join public.answer_keys k on k.question_version_id = v_version.id and k.item_number = (item ->> 'item_number')::integer;
  else
    select jsonb_build_array(jsonb_build_object(
             'item', null,
             'text', null,
             'mode', case
               when v_version.task_type = 'multiple_choice_single_answer' and jsonb_array_length(v_version.options) > 0
                    and private.choice_label(private.effective_key(k.id)) ~ '^[a-e]$' then 'choice'
               else 'open' end,
             'choices', (select coalesce(jsonb_agg(lower(o ->> 'label') order by n), '[]'::jsonb) from jsonb_array_elements(v_version.options) with ordinality as x (o, n))))
    into v_items
    from (select 1) one
    left join public.answer_keys k on k.question_version_id = v_version.id and k.item_number is null;
  end if;

  select jsonb_build_object(
    'question_version_id', v_version.id,
    'record_key', q.stable_key,
    'subject_id', v_version.subject_id,
    'area_id', v_version.area_id,
    'area', a.label,
    'task_type', v_version.task_type,
    'catalogue_level', v_version.catalogue_level,
    'text', v_version.raw_text,
    'stem', v_version.stem_text,
    'options', v_version.options,
    'has_figure', v_version.has_figure_reference,
    'items', v_items,
    'errata', private.question_errata(v_version.id, false),
    -- AMB-04 (a): listening tasks show the printed transcript, labelled, until audio exists.
    'transcript', ir.record -> 'stimulus' ->> 'transcript_raw_text',
    'source', jsonb_build_object('page', (v_version.source_regions -> 0 ->> 'page')::integer, 'official_title', dv.official_title,
                                 'sha256', dv.sha256))
  into v_question
  from public.questions q
  left join public.subject_areas a on a.id = v_version.area_id
  left join public.ingested_records ir on ir.id = v_version.record_id
  join public.canonical_document_versions dv on dv.id = v_version.document_version_id
  where q.id = v_version.question_id;
  return v_question;
end;
$$;
