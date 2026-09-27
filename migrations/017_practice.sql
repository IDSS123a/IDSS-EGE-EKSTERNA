-- Migration: 017_practice
-- Date: 2026-09-27
-- Author: ACA (Claude Code)
-- Description: Student practice over trusted questions (Sprint 06 items 3-4; PDL-018, PDL-024; DATA_MODEL §6).
--   * practice_answers: one row per submitted answer, bound to the person (history survives account archival),
--     append-only. Responses, the auto-check outcome and per-item results are stored.
--   * Students never read questions, keys or answers from tables: practice_next() returns a question without any key,
--     practice_submit() checks and stores the answer and only then returns the solution (PDL-018: the solution after
--     the student's answer, never before). practice_overview() returns counts for the Game Hub.
--   * Auto-check only where the catalogue key is unambiguous: single-choice tasks whose key is an option letter
--     (question level or per scored item) and German true/false items (r/f). Every other task (matching, completion,
--     short and open answers, Math working) is stored for the teacher (outcome awaiting_teacher); the printed solution
--     is shown after the answer where the catalogue has one (P-4: nothing interpreted beyond the key).
--   * The effective key is the newest reviewed key revision, else the printed key (CF-03); the effective text is the
--     newest reviewed text revision, else the trusted version (PDL-021).
--   * German listening tasks show the official transcript, labelled, until audio exists (AMB-04 option a).
--   All functions SECURITY INVOKER, service_role only, re-checking practice.participate for the actor.
-- Rollback:
--   drop function if exists public.practice_submit(uuid, uuid, jsonb), public.practice_next(uuid, uuid, uuid),
--     public.practice_overview(uuid), private.practice_question(uuid), private.practice_person(uuid),
--     private.choice_label(text), private.effective_key(uuid);
--   drop table if exists public.practice_answers;

-- ---------------------------------------------------------------------------- helpers
-- Option letter of a key: "c)", "c", "b)\nSREDNJI NIVO" give c/b; anything else gives null (not auto-checkable).
create or replace function private.choice_label(value text)
returns text
language sql immutable parallel safe set search_path = ''
as $$
  select lower((regexp_match(btrim(coalesce(value, '')), '^([a-eA-E])\)?(\s|$)'))[1])
$$;
revoke all on function private.choice_label(text) from public, anon;
grant execute on function private.choice_label(text) to service_role;

-- Effective key of one printed key: the newest reviewed revision, else the printed answer (CF-03).
create or replace function private.effective_key(p_answer_key_id uuid)
returns text
language sql stable set search_path = ''
as $$
  select coalesce(
    (select r.corrected_answer from public.answer_key_revisions r where r.answer_key_id = p_answer_key_id order by r.created_at desc limit 1),
    (select k.printed_answer from public.answer_keys k where k.id = p_answer_key_id))
$$;
revoke all on function private.effective_key(uuid) from public, anon;
grant execute on function private.effective_key(uuid) to service_role;

-- The person of an active student account; created on first use (history is bound to the person).
create or replace function private.practice_person(p_actor uuid)
returns uuid
language plpgsql set search_path = ''
as $$
declare
  v_person uuid;
begin
  if not private.actor_has_capability(p_actor, 'practice.participate') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select id into v_person from public.persons where profile_user_id = p_actor;
  if v_person is null then
    insert into public.persons (profile_user_id) values (p_actor) on conflict (profile_user_id) do nothing returning id into v_person;
    if v_person is null then
      select id into v_person from public.persons where profile_user_id = p_actor;
    end if;
  end if;
  return v_person;
end;
$$;
revoke all on function private.practice_person(uuid) from public, anon, authenticated;
grant execute on function private.practice_person(uuid) to service_role;

-- ---------------------------------------------------------------------------- answers
create table public.practice_answers (
  id                  uuid primary key default gen_random_uuid(),
  person_id           uuid not null references public.persons (id) on delete restrict,
  question_version_id uuid not null references public.question_versions (id) on delete restrict,
  subject_id          uuid not null references public.subjects (id) on delete restrict,
  area_id             uuid references public.subject_areas (id) on delete restrict,
  -- [{item: n | null, response: text}]
  responses           jsonb not null check (jsonb_typeof(responses) = 'array'),
  -- [{item, mode: choice | true_false | open, correct: true | false | null}]
  results             jsonb not null check (jsonb_typeof(results) = 'array'),
  outcome             text not null check (outcome in ('correct', 'partly_correct', 'incorrect', 'awaiting_teacher')),
  items_checked       integer not null check (items_checked >= 0),
  items_correct       integer not null check (items_correct between 0 and items_checked),
  submitted_at        timestamptz not null default now()
);
create index practice_answers_person_idx on public.practice_answers (person_id, submitted_at desc);
create index practice_answers_question_idx on public.practice_answers (question_version_id);
create index practice_answers_subject_idx on public.practice_answers (subject_id, submitted_at desc);
create index practice_answers_area_idx on public.practice_answers (area_id);

create trigger practice_answers_append_only before update or delete on public.practice_answers
  for each row execute function public.reject_audit_mutation();

alter table public.practice_answers enable row level security;
-- The student reads own answers; staff with progress rights read answers of their subjects (the teacher's queue).
create policy practice_answers_select on public.practice_answers for select to authenticated using (
  exists (select 1 from public.persons p where p.id = person_id and p.profile_user_id = (select auth.uid()))
  or private.has_capability('students.view_progress', subject_id));

-- ---------------------------------------------------------------------------- question payload (no keys)
-- What the student sees of a trusted question: the effective text and, per item, how to answer. Never a key.
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
                    and exists (select 1 from regexp_matches(item ->> 'raw_text', '(^|\n)\s*([a-e])\)', 'g')) then 'choice'
               else 'open' end,
             'choices', (select coalesce(jsonb_agg(distinct m[2]), '[]'::jsonb) from regexp_matches(item ->> 'raw_text', '(^|\n)\s*([a-e])\)', 'g') as m))
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

-- ---------------------------------------------------------------------------- next question
-- A question of the subject (and area) the student has not answered yet, else one last answered incorrectly or
-- partly, else the one answered longest ago. Only trusted questions of active catalogue versions.
create or replace function public.practice_next(p_actor uuid, p_subject_id uuid, p_area_id uuid)
returns jsonb
language plpgsql set search_path = ''
as $$
declare
  v_person  uuid;
  v_version uuid;
begin
  v_person := private.practice_person(p_actor);
  if p_subject_id is null or not exists (select 1 from public.subjects where id = p_subject_id)
     or (p_area_id is not null and not exists (select 1 from public.subject_areas where id = p_area_id and subject_id = p_subject_id)) then
    raise exception 'VALIDATION' using errcode = '22023';
  end if;

  with candidates as (
    select qv.id,
           (select pa.outcome from public.practice_answers pa where pa.person_id = v_person and pa.question_version_id = qv.id order by pa.submitted_at desc limit 1) as last_outcome,
           (select max(pa.submitted_at) from public.practice_answers pa where pa.person_id = v_person and pa.question_version_id = qv.id) as last_at
    from public.question_versions qv
    join public.canonical_document_versions v on v.id = qv.document_version_id and v.status = 'active'
    where qv.subject_id = p_subject_id and (p_area_id is null or qv.area_id = p_area_id)
  )
  select id into v_version
  from candidates
  order by case when last_outcome is null then 0 when last_outcome in ('incorrect', 'partly_correct') then 1 else 2 end,
           last_at nulls first,
           md5(id::text || v_person::text || current_date::text)
  limit 1;

  if v_version is null then
    return null;
  end if;
  return private.practice_question(v_version);
end;
$$;
revoke all on function public.practice_next(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.practice_next(uuid, uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------- submit
-- p_responses: [{item: n | null, response: text}], one per item of the question. Returns the outcome, the per-item
-- result and, now that the student has answered, the solution (effective keys) of every item.
create or replace function public.practice_submit(p_actor uuid, p_question_version_id uuid, p_responses jsonb)
returns jsonb
language plpgsql set search_path = ''
as $$
declare
  v_person   uuid;
  v_version  public.question_versions%rowtype;
  v_question jsonb;
  v_results  jsonb;
  v_checked  integer;
  v_correct  integer;
  v_open     integer;
  v_outcome  text;
begin
  v_person := private.practice_person(p_actor);
  select * into v_version from public.question_versions where id = p_question_version_id;
  if not found or not exists (select 1 from public.canonical_document_versions v where v.id = v_version.document_version_id and v.status = 'active') then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  v_question := private.practice_question(v_version.id);

  -- One response per item, each a string of at most 4000 characters, for exactly the items of the question.
  if p_responses is null or jsonb_typeof(p_responses) <> 'array'
     or jsonb_array_length(p_responses) <> jsonb_array_length(v_question -> 'items')
     or exists (select 1 from jsonb_array_elements(p_responses) r
                where jsonb_typeof(r -> 'response') is distinct from 'string' or length(r ->> 'response') > 4000)
     or exists (select 1 from jsonb_array_elements(v_question -> 'items') i
                where not exists (select 1 from jsonb_array_elements(p_responses) r where (r -> 'item') is not distinct from (i -> 'item')))
  then
    raise exception 'VALIDATION' using errcode = '22023';
  end if;

  select jsonb_agg(jsonb_build_object(
           'item', i -> 'item',
           'mode', i ->> 'mode',
           'response', r ->> 'response',
           'correct', case
             when i ->> 'mode' = 'choice' then lower(btrim(r ->> 'response')) = private.choice_label(private.effective_key(k.id))
             when i ->> 'mode' = 'true_false' then lower(btrim(r ->> 'response')) = lower(btrim(private.effective_key(k.id)))
             end,
           'solution', private.effective_key(k.id))
         order by (i ->> 'item')::integer nulls first)
  into v_results
  from jsonb_array_elements(v_question -> 'items') i
  join jsonb_array_elements(p_responses) r on (r -> 'item') is not distinct from (i -> 'item')
  left join public.answer_keys k on k.question_version_id = v_version.id and k.item_number is not distinct from (i ->> 'item')::integer;

  select count(*) filter (where x ->> 'mode' <> 'open'),
         count(*) filter (where (x ->> 'correct')::boolean),
         count(*) filter (where x ->> 'mode' = 'open')
  into v_checked, v_correct, v_open
  from jsonb_array_elements(v_results) x;
  v_outcome := case
    when v_open > 0 then 'awaiting_teacher'
    when v_correct = v_checked then 'correct'
    when v_correct = 0 then 'incorrect'
    else 'partly_correct' end;

  insert into public.practice_answers (person_id, question_version_id, subject_id, area_id, responses, results, outcome, items_checked, items_correct)
  values (v_person, v_version.id, v_version.subject_id, v_version.area_id,
          (select jsonb_agg(jsonb_build_object('item', x -> 'item', 'response', x ->> 'response')) from jsonb_array_elements(v_results) x),
          (select jsonb_agg(jsonb_build_object('item', x -> 'item', 'mode', x ->> 'mode', 'correct', x -> 'correct')) from jsonb_array_elements(v_results) x),
          v_outcome, v_checked, v_correct);

  return jsonb_build_object('outcome', v_outcome, 'items_checked', v_checked, 'items_correct', v_correct, 'results', v_results);
end;
$$;
revoke all on function public.practice_submit(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.practice_submit(uuid, uuid, jsonb) to service_role;

-- ---------------------------------------------------------------------------- overview (Game Hub)
-- Per subject and area: trusted questions, questions answered, questions whose latest answer was correct, answers
-- waiting for the teacher; the practice days (Europe/Sarajevo) for streak and daily mission.
create or replace function public.practice_overview(p_actor uuid)
returns jsonb
language plpgsql set search_path = ''
as $$
declare
  v_person uuid;
begin
  v_person := private.practice_person(p_actor);
  return jsonb_build_object(
    'areas', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'subject_id', s.id, 'subject_code', s.code, 'area_id', a.id, 'area', coalesce(a.label, ''), 'ordinal', coalesce(a.ordinal, 0),
               'total', counts.total, 'answered', counts.answered, 'correct', counts.correct, 'awaiting', counts.awaiting)
             order by s.code, coalesce(a.ordinal, 0)), '[]'::jsonb)
      from (
        select qv.subject_id, qv.area_id,
               count(*) as total,
               count(latest.outcome) as answered,
               count(*) filter (where latest.outcome = 'correct') as correct,
               count(*) filter (where latest.outcome = 'awaiting_teacher') as awaiting
        from public.question_versions qv
        join public.canonical_document_versions v on v.id = qv.document_version_id and v.status = 'active'
        left join lateral (
          select pa.outcome from public.practice_answers pa
          where pa.person_id = v_person and pa.question_version_id = qv.id
          order by pa.submitted_at desc limit 1) latest on true
        group by qv.subject_id, qv.area_id
      ) counts
      join public.subjects s on s.id = counts.subject_id
      left join public.subject_areas a on a.id = counts.area_id),
    'days', (
      select coalesce(jsonb_agg(day order by day desc), '[]'::jsonb)
      from (select distinct (pa.submitted_at at time zone 'Europe/Sarajevo')::date as day
            from public.practice_answers pa where pa.person_id = v_person
            order by day desc limit 60) days),
    'today', (
      select count(*) from public.practice_answers pa
      where pa.person_id = v_person and (pa.submitted_at at time zone 'Europe/Sarajevo')::date = (now() at time zone 'Europe/Sarajevo')::date),
    'today_date', (now() at time zone 'Europe/Sarajevo')::date);
end;
$$;
revoke all on function public.practice_overview(uuid) from public, anon, authenticated;
grant execute on function public.practice_overview(uuid) to service_role;
