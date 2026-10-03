-- Migration: 025_gamification
-- Date: 2026-10-03
-- Author: ACA (Claude Code)
-- Description: Sprint 08 item 4 (PDL-029). XP and badges are derived, read-only, from the student's own events:
--   practice answers (the latest outcome per answer, the teacher's verdict counts), practice days, daily missions and
--   mock exams (submitted; graded with the confirmed total). The function writes nothing, so no XP can change a score
--   (P-7, mandate 8.3). Values come from config/gamification.json through the server (p_values), validated here.
-- Rollback: drop function if exists public.gamification_overview(uuid, jsonb);

create or replace function public.gamification_overview(p_actor uuid, p_values jsonb)
returns jsonb
language plpgsql stable set search_path = ''
as $$
declare
  v_person uuid;
  v_xp     jsonb := p_values -> 'xp';
  v_badges jsonb := p_values -> 'badges';
  v_goal   integer := (p_values ->> 'mission_goal')::integer;
  v_result jsonb;
begin
  v_person := private.practice_person(p_actor);
  if v_xp is null or v_badges is null or v_goal is null or v_goal not between 1 and 100
     or exists (select 1 from unnest(array['answer_correct', 'answer_partly_correct', 'answer_incorrect', 'mission_completed',
                  'practice_day', 'mock_exam_submitted', 'mock_exam_point', 'mock_exam_points_cap']) k
                where jsonb_typeof(v_xp -> k) <> 'number' or (v_xp ->> k)::numeric not between 0 and 1000)
     or jsonb_typeof(v_badges -> 'streak_days') <> 'number' or jsonb_typeof(v_badges -> 'answers_in_subject') <> 'number' then
    raise exception 'VALIDATION' using errcode = '22023';
  end if;

  with answers as (
    select pa.subject_id, (pa.submitted_at at time zone 'Europe/Sarajevo')::date as day, private.practice_outcome(pa.id) as outcome
    from public.practice_answers pa where pa.person_id = v_person
  ), days as (
    select day, count(*) as n from answers group by day
  ), runs as (
    select count(*) as length from (select day, day - (row_number() over (order by day))::integer as grp from days) d group by grp
  ), exams as (
    select e.subject_id, e.status, e.total_points from public.mock_exams e
    where e.person_id = v_person and e.status in ('submitted', 'graded')
  ), subject_answers as (
    select s.code, count(a.*) as n from public.subjects s left join answers a on a.subject_id = s.id group by s.code
  )
  select jsonb_build_object(
    'xp', jsonb_build_object(
      'answers', (select coalesce(sum(case outcome when 'correct' then (v_xp ->> 'answer_correct')::numeric
                                               when 'partly_correct' then (v_xp ->> 'answer_partly_correct')::numeric
                                               when 'incorrect' then (v_xp ->> 'answer_incorrect')::numeric else 0 end), 0) from answers),
      'missions', (select count(*) from days where n >= v_goal) * (v_xp ->> 'mission_completed')::numeric,
      'practice_days', (select count(*) from days) * (v_xp ->> 'practice_day')::numeric,
      'exams_submitted', (select count(*) from exams) * (v_xp ->> 'mock_exam_submitted')::numeric,
      'exams_graded', (select coalesce(sum(least((v_xp ->> 'mock_exam_points_cap')::numeric, coalesce(total_points, 0) * (v_xp ->> 'mock_exam_point')::numeric)), 0)
                       from exams where status = 'graded')),
    'badges', jsonb_build_object(
      'first_answer', exists (select 1 from answers),
      'streak', coalesce((select max(length) from runs), 0) >= (v_badges ->> 'streak_days')::integer,
      'answers_in_subject', (select coalesce(jsonb_agg(code order by code), '[]'::jsonb) from subject_answers where n >= (v_badges ->> 'answers_in_subject')::integer),
      'first_mock_exam', (select coalesce(jsonb_agg(distinct s.code), '[]'::jsonb) from exams x join public.subjects s on s.id = x.subject_id),
      'all_subjects', (select count(distinct subject_id) from exams) >= (select count(*) from public.subjects)))
  into v_result;
  return v_result;
end;
$$;
revoke all on function public.gamification_overview(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.gamification_overview(uuid, jsonb) to service_role;
