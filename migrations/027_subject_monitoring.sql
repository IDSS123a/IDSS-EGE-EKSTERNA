-- Migration: 027_subject_monitoring
-- Date: 2026-10-03
-- Author: ACA (Claude Code)
-- Description: Sprint 09 (implementation plan row 09, ROLES §2 "View student academic progress" scoped for the subject
--   teacher, PDL-018 item 3, PDL-033). The monitoring functions of migration 026 also serve a subject-scoped
--   students.view_progress: the reader sees only the subjects of the scope (activity, profile, group analysis); the
--   daily mission (all subjects) and support notes stay hidden. New daily_summary: per subject in scope, who practised
--   on a day, who did not (with the last practice), areas of that day by accuracy, open work. No new data is collected.
--   create or replace only; no DROP.
-- Rollback: re-run the overview, profile and group analysis sections of 026_support_monitoring.sql;
--   drop function if exists public.daily_summary(uuid, date), private.actor_progress_subjects(uuid);

-- Subjects whose progress the actor may read: null for an unscoped holder (all subjects), else the subjects of the
-- scoped bundles (empty when the actor holds no students.view_progress).
create or replace function private.actor_progress_subjects(actor uuid)
returns uuid[]
language sql stable security definer set search_path = ''
as $$
  select case when private.actor_has_unscoped_capability(actor, 'students.view_progress') then null
    else coalesce((
      select array_agg(distinct pb.scope_subject_id)
      from public.profiles p
      join public.profile_bundles pb on pb.profile_user_id = p.user_id and pb.scope_subject_id is not null
      join public.bundle_capabilities bc on bc.bundle_code = pb.bundle_code
      where p.user_id = actor and p.account_status = 'active' and bc.capability_code = 'students.view_progress'), '{}'::uuid[])
  end
$$;
revoke all on function private.actor_progress_subjects(uuid) from public, anon, authenticated;
grant execute on function private.actor_progress_subjects(uuid) to service_role;

-- ---------------------------------------------------------------------------- overview
create or replace function public.support_overview(p_actor uuid)
returns jsonb
language plpgsql stable set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Europe/Sarajevo')::date;
  v_scope uuid[] := private.actor_progress_subjects(p_actor);
begin
  if v_scope is not null and cardinality(v_scope) = 0 then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return (
    select coalesce(jsonb_agg(r order by r ->> 'name'), '[]'::jsonb)
    from (
      select jsonb_build_object(
        'person_id', pe.id, 'name', pr.display_name, 'status', pr.account_status,
        'last_activity', (select max(pa.submitted_at) from public.practice_answers pa where pa.person_id = pe.id and (v_scope is null or pa.subject_id = any(v_scope))),
        'days_7', (select count(distinct (pa.submitted_at at time zone 'Europe/Sarajevo')::date) from public.practice_answers pa
                   where pa.person_id = pe.id and (v_scope is null or pa.subject_id = any(v_scope)) and (pa.submitted_at at time zone 'Europe/Sarajevo')::date > v_today - 7),
        'days_30', (select count(distinct (pa.submitted_at at time zone 'Europe/Sarajevo')::date) from public.practice_answers pa
                    where pa.person_id = pe.id and (v_scope is null or pa.subject_id = any(v_scope)) and (pa.submitted_at at time zone 'Europe/Sarajevo')::date > v_today - 30),
        'subjects', (
          select coalesce(jsonb_agg(jsonb_build_object(
                   'code', s.code,
                   'total', (select count(*) from public.question_versions qv join public.canonical_document_versions v on v.id = qv.document_version_id and v.status = 'active' where qv.subject_id = s.id),
                   'answered', (select count(distinct pa.question_version_id) from public.practice_answers pa where pa.person_id = pe.id and pa.subject_id = s.id),
                   'mastered', (select count(*) from (select distinct on (pa.question_version_id) private.practice_outcome(pa.id) as o
                                from public.practice_answers pa where pa.person_id = pe.id and pa.subject_id = s.id
                                order by pa.question_version_id, pa.submitted_at desc) l where l.o = 'correct'),
                   'checked_30', (select count(*) from public.practice_answers pa where pa.person_id = pe.id and pa.subject_id = s.id
                                  and pa.submitted_at > now() - interval '30 days' and private.practice_outcome(pa.id) in ('correct', 'partly_correct', 'incorrect')),
                   'correct_30', (select count(*) from public.practice_answers pa where pa.person_id = pe.id and pa.subject_id = s.id
                                  and pa.submitted_at > now() - interval '30 days' and private.practice_outcome(pa.id) = 'correct'),
                   'exams', (select coalesce(jsonb_agg(jsonb_build_object('points', e.total_points, 'max', e.max_points, 'graded_at', e.graded_at) order by e.graded_at desc), '[]'::jsonb)
                             from (select * from public.mock_exams e where e.person_id = pe.id and e.subject_id = s.id and e.status = 'graded' order by e.graded_at desc limit 2) e),
                   'open', (select count(*) from public.practice_answers pa where pa.person_id = pe.id and pa.subject_id = s.id and private.practice_outcome(pa.id) = 'awaiting_teacher')
                     + (select count(*) from public.mock_exams e where e.person_id = pe.id and e.subject_id = s.id and e.status = 'submitted'),
                   'readiness', private.support_readiness(pe.id, s.id))
                 order by s.code), '[]'::jsonb)
          from public.subjects s where v_scope is null or s.id = any(v_scope))) as r
      from public.persons pe
      join public.profiles pr on pr.user_id = pe.profile_user_id
      where pr.role = 'student' and pr.account_status <> 'archived'
    ) rows);
end;
$$;
revoke all on function public.support_overview(uuid) from public, anon, authenticated;
grant execute on function public.support_overview(uuid) to service_role;

-- ---------------------------------------------------------------------------- student profile
create or replace function public.support_student(p_actor uuid, p_person uuid, p_mission_goal integer, p_ip inet)
returns jsonb
language plpgsql set search_path = ''
as $$
declare
  v_name  text;
  v_today date := (now() at time zone 'Europe/Sarajevo')::date;
  v_scope uuid[] := private.actor_progress_subjects(p_actor);
begin
  if v_scope is not null and cardinality(v_scope) = 0 then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select pr.display_name into v_name from public.persons pe join public.profiles pr on pr.user_id = pe.profile_user_id
  where pe.id = p_person and pr.role = 'student';
  if v_name is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if p_mission_goal is null or p_mission_goal not between 1 and 100 then
    raise exception 'VALIDATION' using errcode = '22023';
  end if;
  -- Access audit (ROLES §3): every opening of an individual profile.
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address)
  values (p_actor, 'support.profile_viewed', 'persons', p_person::text,
          case when v_scope is null then '{}'::jsonb else jsonb_build_object('scope', 'subject') end, p_ip);

  return jsonb_build_object(
    'person_id', p_person,
    'name', v_name,
    'last_activity', (select max(pa.submitted_at) from public.practice_answers pa where pa.person_id = p_person and (v_scope is null or pa.subject_id = any(v_scope))),
    'days', (select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'answers', d.n) order by d.day), '[]'::jsonb)
             from (select (pa.submitted_at at time zone 'Europe/Sarajevo')::date as day, count(*) as n from public.practice_answers pa
                   where pa.person_id = p_person and (v_scope is null or pa.subject_id = any(v_scope))
                     and (pa.submitted_at at time zone 'Europe/Sarajevo')::date > v_today - 60 group by 1) d),
    -- The daily mission counts answers of every subject; a subject-scoped reader does not see it.
    'missions_30', case when v_scope is null then (select count(*) from (select (pa.submitted_at at time zone 'Europe/Sarajevo')::date as day from public.practice_answers pa
                    where pa.person_id = p_person and (pa.submitted_at at time zone 'Europe/Sarajevo')::date > v_today - 30
                    group by 1 having count(*) >= p_mission_goal) m) end,
    'today', v_today,
    'subjects', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'code', s.code,
               'total', (select count(*) from public.question_versions qv join public.canonical_document_versions v on v.id = qv.document_version_id and v.status = 'active' where qv.subject_id = s.id),
               'answered', (select count(distinct pa.question_version_id) from public.practice_answers pa where pa.person_id = p_person and pa.subject_id = s.id),
               'checked', (select count(*) from public.practice_answers pa where pa.person_id = p_person and pa.subject_id = s.id and private.practice_outcome(pa.id) in ('correct', 'partly_correct', 'incorrect')),
               'correct', (select count(*) from public.practice_answers pa where pa.person_id = p_person and pa.subject_id = s.id and private.practice_outcome(pa.id) = 'correct'),
               'checked_30', (select count(*) from public.practice_answers pa where pa.person_id = p_person and pa.subject_id = s.id and pa.submitted_at > now() - interval '30 days' and private.practice_outcome(pa.id) in ('correct', 'partly_correct', 'incorrect')),
               'correct_30', (select count(*) from public.practice_answers pa where pa.person_id = p_person and pa.subject_id = s.id and pa.submitted_at > now() - interval '30 days' and private.practice_outcome(pa.id) = 'correct'),
               'mastered', (select count(*) from (select distinct on (pa.question_version_id) private.practice_outcome(pa.id) as o
                            from public.practice_answers pa where pa.person_id = p_person and pa.subject_id = s.id
                            order by pa.question_version_id, pa.submitted_at desc) l where l.o = 'correct'),
               'areas', (
                 select coalesce(jsonb_agg(jsonb_build_object('area', a.area, 'ordinal', a.ordinal, 'total', a.total, 'answered', a.answered, 'correct', a.correct)
                          order by a.ordinal), '[]'::jsonb)
                 from (
                   select coalesce(sa.label, '') as area, coalesce(sa.ordinal, 0) as ordinal, count(*) as total,
                          count(latest.o) as answered, count(*) filter (where latest.o = 'correct') as correct
                   from public.question_versions qv
                   join public.canonical_document_versions v on v.id = qv.document_version_id and v.status = 'active'
                   left join public.subject_areas sa on sa.id = qv.area_id
                   left join lateral (select private.practice_outcome(pa.id) as o from public.practice_answers pa
                                      where pa.person_id = p_person and pa.question_version_id = qv.id order by pa.submitted_at desc limit 1) latest on true
                   where qv.subject_id = s.id
                   group by 1, 2) a),
               -- D4: wrong at least twice and the latest answer still wrong.
               'persistent_errors', (
                 select coalesce(jsonb_agg(jsonb_build_object('question_version_id', x.qid, 'record_key', ir.record_key, 'wrong', x.wrong, 'last_at', x.last_at)
                          order by x.wrong desc, x.last_at desc), '[]'::jsonb)
                 from (
                   select pa.question_version_id as qid, count(*) filter (where private.practice_outcome(pa.id) = 'incorrect') as wrong,
                          max(pa.submitted_at) as last_at,
                          (array_agg(private.practice_outcome(pa.id) order by pa.submitted_at desc))[1] as latest
                   from public.practice_answers pa where pa.person_id = p_person and pa.subject_id = s.id
                   group by pa.question_version_id) x
                 join public.question_versions qv on qv.id = x.qid
                 join public.ingested_records ir on ir.id = qv.record_id
                 where x.wrong >= 2 and x.latest = 'incorrect'),
               'exams', (
                 select coalesce(jsonb_agg(jsonb_build_object(
                          'id', e.id, 'status', e.status, 'submitted_at', e.submitted_at, 'graded_at', e.graded_at,
                          'points', case when e.status = 'graded' then e.total_points end, 'max', e.max_points, 'auto', e.auto_submitted,
                          'minutes_used', case when e.started_at is not null and e.submitted_at is not null then round(extract(epoch from (e.submitted_at - e.started_at)) / 60) end,
                          'minutes', round(extract(epoch from (e.deadline_at - e.started_at)) / 60),
                          'empty_units', (select count(*) from public.mock_exam_items mi where mi.mock_exam_id = e.id and btrim(mi.response) = ''),
                          'units', (select count(*) from public.mock_exam_items mi where mi.mock_exam_id = e.id))
                          order by coalesce(e.submitted_at, e.created_at)), '[]'::jsonb)
                 from public.mock_exams e where e.person_id = p_person and e.subject_id = s.id and e.status in ('submitted', 'graded')),
               'readiness', private.support_readiness(p_person, s.id))
             order by s.code), '[]'::jsonb)
      from public.subjects s where v_scope is null or s.id = any(v_scope)),
    'notes', private.support_notes_of(p_actor, p_person),
    'can_write_notes', private.actor_has_capability(p_actor, 'support_notes.read_write'),
    'default_visibility', case when exists (select 1 from public.profile_bundles pb where pb.profile_user_id = p_actor and pb.bundle_code = 'psychologist') then 'author' else 'support' end);
end;
$$;
revoke all on function public.support_student(uuid, uuid, integer, inet) from public, anon, authenticated;
grant execute on function public.support_student(uuid, uuid, integer, inet) to service_role;

-- ---------------------------------------------------------------------------- group analysis (aggregates only)
create or replace function public.support_patterns(p_actor uuid)
returns jsonb
language plpgsql stable set search_path = ''
as $$
declare
  v_scope uuid[] := private.actor_progress_subjects(p_actor);
begin
  if v_scope is not null and cardinality(v_scope) = 0 then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'students', (select count(*) from public.profiles where role = 'student' and account_status = 'active'),
    'weeks', (
      select coalesce(jsonb_agg(jsonb_build_object('week', w.week, 'students', w.students, 'answers', w.answers) order by w.week), '[]'::jsonb)
      from (select date_trunc('week', pa.submitted_at at time zone 'Europe/Sarajevo')::date as week, count(distinct pa.person_id) as students, count(*) as answers
            from public.practice_answers pa where pa.submitted_at > now() - interval '12 weeks' and (v_scope is null or pa.subject_id = any(v_scope)) group by 1) w),
    'areas', (
      select coalesce(jsonb_agg(jsonb_build_object('subject', a.code, 'area', a.area, 'ordinal', a.ordinal, 'checked', a.checked, 'correct', a.correct)
               order by a.code, a.ordinal), '[]'::jsonb)
      from (select s.code, coalesce(sa.label, '') as area, coalesce(sa.ordinal, 0) as ordinal,
                   count(*) filter (where private.practice_outcome(pa.id) in ('correct', 'partly_correct', 'incorrect')) as checked,
                   count(*) filter (where private.practice_outcome(pa.id) = 'correct') as correct
            from public.practice_answers pa
            join public.question_versions qv on qv.id = pa.question_version_id
            join public.subjects s on s.id = pa.subject_id
            left join public.subject_areas sa on sa.id = qv.area_id
            where v_scope is null or pa.subject_id = any(v_scope)
            group by 1, 2, 3) a),
    'exam_points', (
      select coalesce(jsonb_agg(jsonb_build_object('subject', x.code, 'points', x.points, 'exams', x.n) order by x.code, x.points), '[]'::jsonb)
      from (select s.code, floor(e.total_points)::integer as points, count(*) as n
            from public.mock_exams e join public.subjects s on s.id = e.subject_id where e.status = 'graded' and (v_scope is null or e.subject_id = any(v_scope)) group by 1, 2) x),
    'missed_questions', (
      select coalesce(jsonb_agg(jsonb_build_object('subject', m.code, 'record_key', m.record_key, 'wrong', m.wrong, 'students', m.students) order by m.wrong desc, m.record_key), '[]'::jsonb)
      from (select s.code, ir.record_key, count(*) as wrong, count(distinct pa.person_id) as students
            from public.practice_answers pa
            join public.question_versions qv on qv.id = pa.question_version_id
            join public.ingested_records ir on ir.id = qv.record_id
            join public.subjects s on s.id = pa.subject_id
            where private.practice_outcome(pa.id) = 'incorrect' and (v_scope is null or pa.subject_id = any(v_scope))
            group by 1, 2 order by 3 desc limit 15) m));
end;
$$;
revoke all on function public.support_patterns(uuid) from public, anon, authenticated;
grant execute on function public.support_patterns(uuid) to service_role;

-- ---------------------------------------------------------------------------- daily summary (PDL-018 item 3)
-- One Europe/Sarajevo day, at most 30 days back. Facts only: no threshold labels a student inactive; the reader sees
-- who did not practise that day and when each last practised in the subject.
create or replace function public.daily_summary(p_actor uuid, p_day date)
returns jsonb
language plpgsql stable set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Europe/Sarajevo')::date;
  v_scope uuid[] := private.actor_progress_subjects(p_actor);
begin
  if v_scope is not null and cardinality(v_scope) = 0 then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_day is null or p_day > v_today or p_day < v_today - 30 then
    raise exception 'VALIDATION' using errcode = '22023';
  end if;
  return jsonb_build_object(
    'day', p_day,
    'today', v_today,
    'subjects', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'code', s.code,
               'practised', (
                 select coalesce(jsonb_agg(jsonb_build_object('person_id', d.person_id, 'name', d.name, 'answers', d.answers, 'checked', d.checked, 'correct', d.correct)
                          order by d.name), '[]'::jsonb)
                 from (select pa.person_id, pr.display_name as name, count(*) as answers,
                              count(*) filter (where x.o in ('correct', 'partly_correct', 'incorrect')) as checked,
                              count(*) filter (where x.o = 'correct') as correct
                       from public.practice_answers pa
                       join public.persons pe on pe.id = pa.person_id
                       join public.profiles pr on pr.user_id = pe.profile_user_id
                       cross join lateral (select private.practice_outcome(pa.id) as o) x
                       where pa.subject_id = s.id and (pa.submitted_at at time zone 'Europe/Sarajevo')::date = p_day
                       group by 1, 2) d),
               'not_practised', (
                 select coalesce(jsonb_agg(jsonb_build_object('person_id', pe.id, 'name', pr.display_name,
                          'last_practice', (select max(pa.submitted_at) from public.practice_answers pa
                                            where pa.person_id = pe.id and pa.subject_id = s.id
                                              and (pa.submitted_at at time zone 'Europe/Sarajevo')::date < p_day))
                          order by pr.display_name), '[]'::jsonb)
                 from public.persons pe
                 join public.profiles pr on pr.user_id = pe.profile_user_id
                 where pr.role = 'student' and pr.account_status = 'active'
                   and not exists (select 1 from public.practice_answers pa where pa.person_id = pe.id and pa.subject_id = s.id
                                   and (pa.submitted_at at time zone 'Europe/Sarajevo')::date = p_day)),
               'areas', (
                 select coalesce(jsonb_agg(jsonb_build_object('area', a.area, 'ordinal', a.ordinal, 'checked', a.checked, 'correct', a.correct)
                          order by a.correct::numeric / nullif(a.checked, 0) nulls last, a.ordinal), '[]'::jsonb)
                 from (select coalesce(sa.label, '') as area, coalesce(sa.ordinal, 0) as ordinal,
                              count(*) filter (where x.o in ('correct', 'partly_correct', 'incorrect')) as checked,
                              count(*) filter (where x.o = 'correct') as correct
                       from public.practice_answers pa
                       join public.question_versions qv on qv.id = pa.question_version_id
                       left join public.subject_areas sa on sa.id = qv.area_id
                       cross join lateral (select private.practice_outcome(pa.id) as o) x
                       where pa.subject_id = s.id and (pa.submitted_at at time zone 'Europe/Sarajevo')::date = p_day
                       group by 1, 2) a),
               'exams_submitted', (select count(*) from public.mock_exams e where e.subject_id = s.id and e.submitted_at is not null
                                   and (e.submitted_at at time zone 'Europe/Sarajevo')::date = p_day),
               'waiting_answers', (select count(*) from public.practice_answers pa where pa.subject_id = s.id and private.practice_outcome(pa.id) = 'awaiting_teacher'),
               'waiting_exams', (select count(*) from public.mock_exams e where e.subject_id = s.id and e.status = 'submitted'))
             order by s.code), '[]'::jsonb)
      from public.subjects s where v_scope is null or s.id = any(v_scope)));
end;
$$;
revoke all on function public.daily_summary(uuid, date) from public, anon, authenticated;
grant execute on function public.daily_summary(uuid, date) to service_role;
