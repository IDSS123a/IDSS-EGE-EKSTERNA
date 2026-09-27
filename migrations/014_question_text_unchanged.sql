-- Migration: 014_question_text_unchanged
-- Date: 2026-09-27
-- Author: ACA (Claude Code)
-- Description: Text revisions (migration 013, PDL-021) after the first live use:
--   * line breaks are stored as \n (browser forms submit \r\n);
--   * a revision that does not change the text students currently see is refused with UNCHANGED
--     (four no-op revisions were saved in the first session; append-only, they stay in the history).
-- Rollback: re-apply the revise_question_text definition of migration 013.

create or replace function private.normalize_revision_text(value text)
returns text
language sql immutable parallel safe set search_path = ''
as $$
  select btrim(replace(replace(value, E'\r\n', E'\n'), E'\r', E'\n'))
$$;
revoke all on function private.normalize_revision_text(text) from public, anon;
grant execute on function private.normalize_revision_text(text) to service_role;

create or replace function public.revise_question_text(p_actor uuid, p_question_version_id uuid, p_content jsonb, p_reason text, p_evidence text, p_ip inet)
returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  v_version  public.question_versions%rowtype;
  v_content  jsonb;
  v_current  jsonb;
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
     or (v_version.stem_text is null) <> (jsonb_typeof(p_content -> 'stem_text') is distinct from 'string')
     or (v_version.stem_text is not null and length(btrim(p_content ->> 'stem_text')) not between 1 and 20000)
     or jsonb_typeof(p_content -> 'options') is distinct from 'array'
     or jsonb_typeof(p_content -> 'scored_items') is distinct from 'array'
  then
    raise exception 'VALIDATION' using errcode = '22023';
  end if;
  if (select coalesce(jsonb_agg(o -> 'label' order by n), '[]'::jsonb) from jsonb_array_elements(v_version.options) with ordinality as x (o, n))
        is distinct from (select coalesce(jsonb_agg(o -> 'label' order by n), '[]'::jsonb) from jsonb_array_elements(p_content -> 'options') with ordinality as x (o, n))
     or exists (select 1 from jsonb_array_elements(p_content -> 'options') o
                where jsonb_typeof(o -> 'text') is distinct from 'string' or length(btrim(o ->> 'text')) not between 1 and 2000)
     or (select coalesce(jsonb_agg(i -> 'item_number' order by n), '[]'::jsonb) from jsonb_array_elements(v_version.scored_items) with ordinality as x (i, n))
        is distinct from (select coalesce(jsonb_agg(i -> 'item_number' order by n), '[]'::jsonb) from jsonb_array_elements(p_content -> 'scored_items') with ordinality as x (i, n))
     or exists (select 1 from jsonb_array_elements(p_content -> 'scored_items') i
                where jsonb_typeof(i -> 'raw_text') is distinct from 'string' or length(btrim(i ->> 'raw_text')) not between 1 and 2000)
  then
    raise exception 'VALIDATION' using errcode = '22023';
  end if;

  -- Only the known fields are stored, with \n line breaks.
  v_content := jsonb_build_object(
    'raw_text', private.normalize_revision_text(p_content ->> 'raw_text'),
    'stem_text', case when v_version.stem_text is null then null else private.normalize_revision_text(p_content ->> 'stem_text') end,
    'options', (select coalesce(jsonb_agg(jsonb_build_object('label', o -> 'label', 'text', private.normalize_revision_text(o ->> 'text')) order by n), '[]'::jsonb)
                from jsonb_array_elements(p_content -> 'options') with ordinality as x (o, n)),
    'scored_items', (select coalesce(jsonb_agg(jsonb_build_object('item_number', i -> 'item_number', 'raw_text', private.normalize_revision_text(i ->> 'raw_text')) order by n), '[]'::jsonb)
                     from jsonb_array_elements(p_content -> 'scored_items') with ordinality as x (i, n)));

  -- The text students see now: the newest revision, else the trusted version (both normalised).
  select jsonb_build_object(
    'raw_text', private.normalize_revision_text(c ->> 'raw_text'),
    'stem_text', private.normalize_revision_text(c ->> 'stem_text'),
    'options', (select coalesce(jsonb_agg(jsonb_build_object('label', o -> 'label', 'text', private.normalize_revision_text(o ->> 'text')) order by n), '[]'::jsonb)
                from jsonb_array_elements(c -> 'options') with ordinality as x (o, n)),
    'scored_items', (select coalesce(jsonb_agg(jsonb_build_object('item_number', i -> 'item_number', 'raw_text', private.normalize_revision_text(i ->> 'raw_text')) order by n), '[]'::jsonb)
                     from jsonb_array_elements(c -> 'scored_items') with ordinality as x (i, n)))
  into v_current
  from (select coalesce(
          (select r.content from public.question_text_revisions r where r.question_version_id = v_version.id order by r.created_at desc limit 1),
          jsonb_build_object('raw_text', v_version.raw_text, 'stem_text', v_version.stem_text, 'options', v_version.options, 'scored_items', v_version.scored_items)) as c) current_text;
  if v_content = v_current then
    raise exception 'UNCHANGED' using errcode = '22023';
  end if;

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
