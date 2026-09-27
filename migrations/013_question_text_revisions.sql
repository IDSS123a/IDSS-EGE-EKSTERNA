-- Migration: 013_question_text_revisions
-- Date: 2026-09-27
-- Author: ACA (Claude Code)
-- Description: Reviewed text revisions of trusted questions (AMB-19; ARCHITECTURE §5 normalized text; PDL-021).
--   * question_text_revisions: append-only; the newest revision is the text students see. The trusted question
--     version (the text as printed and extracted) never changes.
--   * A revision changes texts only: the question text, the stem, each option text and each scored item text.
--     Option labels, sub-part labels and scored item numbers must stay exactly as in the version, so a revision
--     can never change what the answer key refers to.
--   * revise_question_text(): SECURITY INVOKER, service_role only; re-checks canon.review for the question's own
--     subject, validates the shape, writes the revision and the audit row in one transaction.
-- Rollback:
--   drop function if exists public.revise_question_text(uuid, uuid, jsonb, text, text, inet);
--   drop table if exists public.question_text_revisions;

create table public.question_text_revisions (
  id                  uuid primary key default gen_random_uuid(),
  question_version_id uuid not null references public.question_versions (id) on delete restrict,
  subject_id          uuid not null references public.subjects (id) on delete restrict,
  -- {raw_text, stem_text, options: [{label, text}], scored_items: [{item_number, raw_text}]}
  content             jsonb not null,
  reason              text not null check (length(reason) between 1 and 2000),
  evidence            text check (evidence is null or length(evidence) between 1 and 2000),
  revised_by          uuid not null references public.profiles (user_id) on delete restrict,
  created_at          timestamptz not null default now()
);
create index question_text_revisions_version_idx on public.question_text_revisions (question_version_id, created_at desc);
create index question_text_revisions_subject_idx on public.question_text_revisions (subject_id);
create index question_text_revisions_revised_by_idx on public.question_text_revisions (revised_by);

create trigger question_text_revisions_append_only before update or delete on public.question_text_revisions
  for each row execute function public.reject_audit_mutation();

alter table public.question_text_revisions enable row level security;
create policy question_text_revisions_select on public.question_text_revisions for select to authenticated using (
  private.has_capability('canon.publish') or private.has_capability('canon.review', subject_id));

create or replace function public.revise_question_text(p_actor uuid, p_question_version_id uuid, p_content jsonb, p_reason text, p_evidence text, p_ip inet)
returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  v_version  public.question_versions%rowtype;
  v_content  jsonb;
  v_revision uuid;
begin
  select * into v_version from public.question_versions where id = p_question_version_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if not (private.actor_has_capability(p_actor, 'canon.publish') or private.actor_has_subject_capability(p_actor, 'canon.review', v_version.subject_id)) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null or length(btrim(p_reason)) > 2000
     or (p_evidence is not null and length(btrim(p_evidence)) > 2000)
     or p_content is null or jsonb_typeof(p_content) <> 'object'
     or jsonb_typeof(p_content -> 'raw_text') is distinct from 'string'
     or length(btrim(p_content ->> 'raw_text')) not between 1 and 20000
     -- the stem is present exactly when the version has one
     or (v_version.stem_text is null) <> (jsonb_typeof(p_content -> 'stem_text') is distinct from 'string')
     or (v_version.stem_text is not null and length(btrim(p_content ->> 'stem_text')) not between 1 and 20000)
     or jsonb_typeof(p_content -> 'options') is distinct from 'array'
     or jsonb_typeof(p_content -> 'scored_items') is distinct from 'array'
  then
    raise exception 'VALIDATION' using errcode = '22023';
  end if;
  -- Element checks only after the shape is known to be arrays.
  if -- same option labels in the same order, each with a non-empty text
     (select coalesce(jsonb_agg(o -> 'label' order by n), '[]'::jsonb) from jsonb_array_elements(v_version.options) with ordinality as x (o, n))
        is distinct from (select coalesce(jsonb_agg(o -> 'label' order by n), '[]'::jsonb) from jsonb_array_elements(p_content -> 'options') with ordinality as x (o, n))
     or exists (select 1 from jsonb_array_elements(p_content -> 'options') o
                where jsonb_typeof(o -> 'text') is distinct from 'string' or length(btrim(o ->> 'text')) not between 1 and 2000)
     -- same scored item numbers in the same order, each with a non-empty text
     or (select coalesce(jsonb_agg(i -> 'item_number' order by n), '[]'::jsonb) from jsonb_array_elements(v_version.scored_items) with ordinality as x (i, n))
        is distinct from (select coalesce(jsonb_agg(i -> 'item_number' order by n), '[]'::jsonb) from jsonb_array_elements(p_content -> 'scored_items') with ordinality as x (i, n))
     or exists (select 1 from jsonb_array_elements(p_content -> 'scored_items') i
                where jsonb_typeof(i -> 'raw_text') is distinct from 'string' or length(btrim(i ->> 'raw_text')) not between 1 and 2000)
  then
    raise exception 'VALIDATION' using errcode = '22023';
  end if;

  -- Only the known fields are stored.
  v_content := jsonb_build_object(
    'raw_text', btrim(p_content ->> 'raw_text'),
    'stem_text', case when v_version.stem_text is null then null else btrim(p_content ->> 'stem_text') end,
    'options', (select coalesce(jsonb_agg(jsonb_build_object('label', o -> 'label', 'text', btrim(o ->> 'text')) order by n), '[]'::jsonb)
                from jsonb_array_elements(p_content -> 'options') with ordinality as x (o, n)),
    'scored_items', (select coalesce(jsonb_agg(jsonb_build_object('item_number', i -> 'item_number', 'raw_text', btrim(i ->> 'raw_text')) order by n), '[]'::jsonb)
                     from jsonb_array_elements(p_content -> 'scored_items') with ordinality as x (i, n)));

  insert into public.question_text_revisions (question_version_id, subject_id, content, reason, evidence, revised_by)
  values (v_version.id, v_version.subject_id, v_content, btrim(p_reason), nullif(btrim(coalesce(p_evidence, '')), ''), p_actor)
  returning id into v_revision;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address)
  values (p_actor, 'review.question_text_revised', 'question_version', v_version.id::text,
          jsonb_build_object('revision_id', v_revision), p_ip);
  return v_revision;
end;
$$;
revoke all on function public.revise_question_text(uuid, uuid, jsonb, text, text, inet) from public, anon, authenticated;
grant execute on function public.revise_question_text(uuid, uuid, jsonb, text, text, inet) to service_role;
