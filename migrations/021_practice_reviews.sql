-- Migration: 021_practice_reviews
-- Date: 2026-10-03
-- Author: ACA (Claude Code)
-- Description: Canon fidelity part 2 (P-15, PDL-027). practice_answer_reviews: the teacher's verdict on a practice answer
--   that waits for the teacher; the latest verdict counts for mastery and for the order of practice questions.
--   Append-only. practice_submit returns the errata of the question with descriptions (the student has answered).
-- Rollback:
--   re-apply public.practice_submit, public.practice_next, public.practice_overview (017);
--   drop function if exists public.practice_review_queue(uuid), public.review_practice_answer(uuid, uuid, text, text, inet),
--     private.practice_outcome(uuid);
--   drop table if exists public.practice_answer_reviews;

-- ---------------------------------------------------------------------------- practice: teacher verdicts
create table public.practice_answer_reviews (
  id                 uuid primary key default gen_random_uuid(),
  practice_answer_id uuid not null references public.practice_answers (id) on delete restrict,
  subject_id         uuid not null references public.subjects (id) on delete restrict,
  verdict            text not null check (verdict in ('correct', 'partly_correct', 'incorrect')),
  note               text check (length(note) <= 2000),
  reviewer           uuid not null references public.profiles (user_id) on delete restrict,
  reviewed_at        timestamptz not null default now()
);
create index practice_answer_reviews_answer_idx on public.practice_answer_reviews (practice_answer_id, reviewed_at desc);
create index practice_answer_reviews_subject_idx on public.practice_answer_reviews (subject_id);
create index practice_answer_reviews_reviewer_idx on public.practice_answer_reviews (reviewer);
create trigger practice_answer_reviews_append_only before update or delete on public.practice_answer_reviews
  for each row execute function public.reject_audit_mutation();
alter table public.practice_answer_reviews enable row level security;
create policy practice_answer_reviews_select on public.practice_answer_reviews for select to authenticated using (
  exists (select 1 from public.practice_answers pa join public.persons p on p.id = pa.person_id
          where pa.id = practice_answer_id and p.profile_user_id = (select auth.uid()))
  or private.has_capability('exams.grade', subject_id) or private.has_capability('students.view_progress', subject_id));

-- The outcome that counts for an answer: the teacher's latest verdict, else the automatic outcome.
create or replace function private.practice_outcome(p_answer_id uuid)
returns text
language sql stable set search_path = ''
as $$
  select coalesce(
    (select r.verdict from public.practice_answer_reviews r where r.practice_answer_id = p_answer_id order by r.reviewed_at desc limit 1),
    (select a.outcome from public.practice_answers a where a.id = p_answer_id))
$$;
revoke all on function private.practice_outcome(uuid) from public, anon, authenticated;
grant execute on function private.practice_outcome(uuid) to service_role;

create or replace function public.practice_review_queue(p_actor uuid)
returns jsonb
language plpgsql stable set search_path = ''
as $$
begin
  if not private.actor_has_capability(p_actor, 'exams.grade') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', pa.id, 'submitted_at', pa.submitted_at, 'student', pr.display_name, 'subject_code', s.code,
             'responses', pa.responses, 'results', pa.results,
             'question', private.practice_question(pa.question_version_id),
             'errata', private.question_errata(pa.question_version_id, true),
             'keys', (select coalesce(jsonb_agg(jsonb_build_object('item', k.item_number, 'key', k.printed_answer) order by k.item_number nulls first), '[]'::jsonb)
                      from public.answer_keys k where k.question_version_id = pa.question_version_id))
           order by pa.submitted_at), '[]'::jsonb)
    from public.practice_answers pa
    join public.subjects s on s.id = pa.subject_id
    join public.persons pe on pe.id = pa.person_id
    join public.profiles pr on pr.user_id = pe.profile_user_id
    where pa.outcome = 'awaiting_teacher'
      and not exists (select 1 from public.practice_answer_reviews r where r.practice_answer_id = pa.id)
      and private.actor_has_subject_capability(p_actor, 'exams.grade', pa.subject_id));
end;
$$;
revoke all on function public.practice_review_queue(uuid) from public, anon, authenticated;
grant execute on function public.practice_review_queue(uuid) to service_role;

create or replace function public.review_practice_answer(p_actor uuid, p_answer_id uuid, p_verdict text, p_note text, p_ip inet)
returns uuid
language plpgsql set search_path = ''
as $$
declare
  v_answer public.practice_answers%rowtype;
  v_id     uuid;
begin
  select * into v_answer from public.practice_answers where id = p_answer_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if not private.actor_has_subject_capability(p_actor, 'exams.grade', v_answer.subject_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if v_answer.outcome <> 'awaiting_teacher' or p_verdict is null or p_verdict not in ('correct', 'partly_correct', 'incorrect')
     or length(coalesce(p_note, '')) > 2000 then
    raise exception 'VALIDATION' using errcode = '22023';
  end if;
  insert into public.practice_answer_reviews (practice_answer_id, subject_id, verdict, note, reviewer)
  values (v_answer.id, v_answer.subject_id, p_verdict, nullif(btrim(coalesce(p_note, '')), ''), p_actor) returning id into v_id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address)
  values (p_actor, 'practice.answer_reviewed', 'practice_answers', v_answer.id::text, jsonb_build_object('verdict', p_verdict), p_ip);
  return v_id;
end;
$$;
revoke all on function public.review_practice_answer(uuid, uuid, text, text, inet) from public, anon, authenticated;
grant execute on function public.review_practice_answer(uuid, uuid, text, text, inet) to service_role;

-- Practice: errata descriptions are part of the answer to the submission (after the student has answered).
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

  return jsonb_build_object('outcome', v_outcome, 'items_checked', v_checked, 'items_correct', v_correct, 'results', v_results,
                            'errata', private.question_errata(v_version.id, true));
end;
$$;

-- Practice: the next question and the overview count the teacher's verdict where there is one.
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
           (select private.practice_outcome(pa.id) from public.practice_answers pa where pa.person_id = v_person and pa.question_version_id = qv.id order by pa.submitted_at desc limit 1) as last_outcome,
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
          select private.practice_outcome(pa.id) as outcome from public.practice_answers pa
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
