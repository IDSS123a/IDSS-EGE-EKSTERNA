-- Migration: 018_practice_item_options
-- Date: 2026-09-27
-- Author: ACA (Claude Code)
-- Description: Practice (migration 017) for single-choice tasks whose options are listed at question level while the key
--   is given per scored item (German Wortschatz, 40 items): the item is answered by choice among the question's options.
--   Found by checking every live question after 017: these 40 items fell back to free text.
-- Rollback: re-apply private.practice_question of migration 017.

create or replace function private.practice_question(p_version_id uuid)
returns jsonb
language plpgsql stable set search_path = ''
as $$
declare
  v_version  public.question_versions%rowtype;
  v_text     jsonb;
  v_items    jsonb;
  v_question jsonb;
begin
  select * into v_version from public.question_versions where id = p_version_id;
  if not found then
    return null;
  end if;
  select coalesce(
    (select r.content from public.question_text_revisions r where r.question_version_id = v_version.id order by r.created_at desc limit 1),
    jsonb_build_object('raw_text', v_version.raw_text, 'stem_text', v_version.stem_text, 'options', v_version.options, 'scored_items', v_version.scored_items))
  into v_text;

  if jsonb_array_length(v_version.scored_items) > 0 then
    -- One answer per scored item (German tasks): choice letters from the item's own lines, r/f, or free text.
    select coalesce(jsonb_agg(jsonb_build_object(
             'item', (item ->> 'item_number')::integer,
             'text', item ->> 'raw_text',
             'mode', case
               when v_version.task_type = 'true_false' and lower(btrim(private.effective_key(k.id))) in ('r', 'f') then 'true_false'
               when v_version.task_type = 'multiple_choice_single_answer' and private.choice_label(private.effective_key(k.id)) is not null
                    and (exists (select 1 from regexp_matches(item ->> 'raw_text', '(^|\n)\s*([a-e])\)', 'g'))
                         or jsonb_array_length(v_version.options) > 0) then 'choice'
               else 'open' end,
             -- Letters listed in the item itself (German listening items), else the question's options (Wortschatz).
             'choices', coalesce(
               (select jsonb_agg(distinct m[2]) from regexp_matches(item ->> 'raw_text', '(^|\n)\s*([a-e])\)', 'g') as m),
               (select coalesce(jsonb_agg(lower(o ->> 'label') order by n), '[]'::jsonb) from jsonb_array_elements(v_version.options) with ordinality as x (o, n))))
           order by (item ->> 'item_number')::integer), '[]'::jsonb)
    into v_items
    from jsonb_array_elements(coalesce(v_text -> 'scored_items', v_version.scored_items)) item
    left join public.answer_keys k on k.question_version_id = v_version.id and k.item_number = (item ->> 'item_number')::integer;
  else
    -- One answer for the whole task: a choice of the listed options when the key is an option letter, else free text.
    select jsonb_build_array(jsonb_build_object(
             'item', null,
             'text', null,
             'mode', case
               when v_version.task_type = 'multiple_choice_single_answer' and jsonb_array_length(v_version.options) > 0
                    and private.choice_label(private.effective_key(k.id)) is not null then 'choice'
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
    'text', v_text ->> 'raw_text',
    'stem', v_text ->> 'stem_text',
    'options', coalesce(v_text -> 'options', '[]'::jsonb),
    'has_figure', v_version.has_figure_reference,
    'items', v_items,
    -- AMB-04 (a): listening tasks show the printed transcript, labelled, until audio exists.
    'transcript', ir.record -> 'stimulus' ->> 'transcript_raw_text',
    'source', jsonb_build_object('page', (v_version.source_regions -> 0 ->> 'page')::integer, 'official_title', dv.official_title))
  into v_question
  from public.questions q
  left join public.subject_areas a on a.id = v_version.area_id
  left join public.ingested_records ir on ir.id = v_version.record_id
  join public.canonical_document_versions dv on dv.id = v_version.document_version_id
  where q.id = v_version.question_id;
  return v_question;
end;
$$;
revoke all on function private.practice_question(uuid) from public, anon, authenticated;
grant execute on function private.practice_question(uuid) to service_role;

