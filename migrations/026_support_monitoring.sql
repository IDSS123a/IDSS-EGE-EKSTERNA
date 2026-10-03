-- Migration: 026_support_monitoring
-- Date: 2026-10-03
-- Author: ACA (Claude Code)
-- Description: Sprint 09 (SUPPORT_MONITORING.md, PDL-032). Read-only monitoring functions for accounts with unscoped
--   students.view_progress (pedagogue, psychologist, superadministrator): student overview, student profile (five
--   dimensions, areas, persistent errors D4, activity, mock exam trend, IDSS readiness scale), group analysis
--   (aggregates). Support notes: append-only, visibility "author" or "support" (D1 defaults by role bundle), readable
--   and writable only with support_notes.read_write (D2: not the superadministrator), neutral types (D3). Every
--   profile read writes an access audit row (ROLES §3).
-- Rollback:
--   drop function if exists public.support_overview(uuid), public.support_student(uuid, uuid, integer, inet),
--     public.support_patterns(uuid), public.support_note_add(uuid, uuid, text, text, date, text, inet),
--     public.support_follow_ups(uuid), private.support_notes_of(uuid, uuid), private.actor_has_unscoped_capability(uuid, text),
--     private.support_readiness(uuid, uuid), private.readiness_state(bigint, bigint);
--   drop table if exists public.support_notes;

-- A capability held for all subjects: through the role or a bundle without a subject scope.
create or replace function private.actor_has_unscoped_capability(actor uuid, capability text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    join public.role_capabilities rc on rc.role = p.role
    where p.user_id = actor and p.account_status = 'active' and rc.capability_code = capability
  ) or exists (
    select 1 from public.profiles p
    join public.profile_bundles pb on pb.profile_user_id = p.user_id and pb.scope_subject_id is null
    join public.bundle_capabilities bc on bc.bundle_code = pb.bundle_code
    where p.user_id = actor and p.account_status = 'active' and bc.capability_code = capability
  )
$$;
revoke all on function private.actor_has_unscoped_capability(uuid, text) from public, anon, authenticated;
grant execute on function private.actor_has_unscoped_capability(uuid, text) to service_role;

-- ---------------------------------------------------------------------------- support notes
create table public.support_notes (
  id           uuid primary key default gen_random_uuid(),
  person_id    uuid not null references public.persons (id) on delete restrict,
  author       uuid not null references public.profiles (user_id) on delete restrict,
  kind         text check (kind in ('student_talk', 'parent_talk', 'agreement', 'observation')),
  body         text not null check (length(btrim(body)) between 1 and 4000),
  follow_up_on date,
  visibility   text not null check (visibility in ('author', 'support')),
  created_at   timestamptz not null default now()
);
create index support_notes_person_idx on public.support_notes (person_id, created_at desc);
create index support_notes_author_idx on public.support_notes (author);
create trigger support_notes_append_only before update or delete on public.support_notes
  for each row execute function public.reject_audit_mutation();
alter table public.support_notes enable row level security;
create policy support_notes_select on public.support_notes for select to authenticated using (
  private.has_capability('support_notes.read_write') and (visibility = 'support' or author = (select auth.uid())));

-- Notes of a student the actor may read (D1, D2).
create or replace function private.support_notes_of(p_actor uuid, p_person uuid)
returns jsonb
language sql stable set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', n.id, 'kind', n.kind, 'body', n.body, 'follow_up_on', n.follow_up_on, 'visibility', n.visibility,
           'created_at', n.created_at, 'author', pr.display_name, 'own', n.author = p_actor)
         order by n.created_at desc), '[]'::jsonb)
  from public.support_notes n
  join public.profiles pr on pr.user_id = n.author
  where n.person_id = p_person and private.actor_has_capability(p_actor, 'support_notes.read_write')
    and (n.visibility = 'support' or n.author = p_actor)
$$;
revoke all on function private.support_notes_of(uuid, uuid) from public, anon, authenticated;
grant execute on function private.support_notes_of(uuid, uuid) to service_role;

create or replace function public.support_note_add(p_actor uuid, p_person uuid, p_kind text, p_body text, p_follow_up date, p_visibility text, p_ip inet)
returns uuid
language plpgsql set search_path = ''
as $$
declare
  v_visibility text;
  v_id         uuid;
begin
  if not private.actor_has_capability(p_actor, 'support_notes.read_write') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if not exists (select 1 from public.persons pe join public.profiles pr on pr.user_id = pe.profile_user_id
                 where pe.id = p_person and pr.role = 'student') then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  -- D1: without an explicit choice the psychologist's notes stay with the author, the pedagogue's are shared.
  v_visibility := coalesce(p_visibility, case when exists (
      select 1 from public.profile_bundles pb where pb.profile_user_id = p_actor and pb.bundle_code = 'psychologist') then 'author' else 'support' end);
  if v_visibility not in ('author', 'support') or (p_kind is not null and p_kind not in ('student_talk', 'parent_talk', 'agreement', 'observation'))
     or length(btrim(coalesce(p_body, ''))) not between 1 and 4000
     or (p_follow_up is not null and p_follow_up < (now() at time zone 'Europe/Sarajevo')::date - 1) then
    raise exception 'VALIDATION' using errcode = '22023';
  end if;
  insert into public.support_notes (person_id, author, kind, body, follow_up_on, visibility)
  values (p_person, p_actor, p_kind, btrim(p_body), p_follow_up, v_visibility) returning id into v_id;
  -- The audit row never carries the note's content (M-15).
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address)
  values (p_actor, 'support.note_added', 'persons', p_person::text, jsonb_build_object('note', v_id, 'visibility', v_visibility), p_ip);
  return v_id;
end;
$$;
revoke all on function public.support_note_add(uuid, uuid, text, text, date, text, inet) from public, anon, authenticated;
grant execute on function public.support_note_add(uuid, uuid, text, text, date, text, inet) to service_role;

-- Follow-up dates of visible notes from yesterday onward, for the start screen of the support roles.
create or replace function public.support_follow_ups(p_actor uuid)
returns jsonb
language plpgsql stable set search_path = ''
as $$
begin
  if not private.actor_has_capability(p_actor, 'support_notes.read_write') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object('person_id', n.person_id, 'student', pr.display_name, 'follow_up_on', n.follow_up_on, 'kind', n.kind)
             order by n.follow_up_on), '[]'::jsonb)
    from public.support_notes n
    join public.persons pe on pe.id = n.person_id
    join public.profiles pr on pr.user_id = pe.profile_user_id
    where n.follow_up_on is not null and n.follow_up_on >= (now() at time zone 'Europe/Sarajevo')::date - 1
      and (n.visibility = 'support' or n.author = p_actor));
end;
$$;
revoke all on function public.support_follow_ups(uuid) from public, anon, authenticated;
grant execute on function public.support_follow_ups(uuid) to service_role;

-- ---------------------------------------------------------------------------- readiness (PDL-032)
-- The Director's scale: exams = graded mock exams counted (at most the last three), errors = units below their maximum.
create or replace function private.readiness_state(p_exams bigint, p_errors bigint)
returns text
language sql immutable set search_path = ''
as $$
  select case when p_exams < 3 then 'not_available' when p_errors = 0 then '100' when p_errors <= 2 then '90'
              when p_errors = 3 then '80' else 'below_80' end
$$;
revoke all on function private.readiness_state(bigint, bigint) from public, anon, authenticated;
grant execute on function private.readiness_state(bigint, bigint) to service_role;

-- Per subject from the three most recent graded mock exams: errors = units below their maximum.
-- 0 errors 100, 1 to 2 errors 90, 3 errors 80, more 'below_80'; fewer than three graded exams 'not_available'.
create or replace function private.support_readiness(p_person uuid, p_subject uuid)
returns jsonb
language sql stable set search_path = ''
as $$
  with recent as (
    select e.id from public.mock_exams e
    where e.person_id = p_person and e.subject_id = p_subject and e.status = 'graded'
    order by e.graded_at desc limit 3
  ), counted as (
    select (select count(*) from recent) as exams,
           (select count(*) from public.mock_exam_items mi where mi.mock_exam_id in (select id from recent)
              and coalesce(mi.final_points, 0) < mi.max_points) as errors
  )
  select jsonb_build_object('exams', exams, 'errors', errors,
    'state', private.readiness_state(exams, errors))
  from counted
$$;
revoke all on function private.support_readiness(uuid, uuid) from public, anon, authenticated;
grant execute on function private.support_readiness(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------- overview
create or replace function public.support_overview(p_actor uuid)
returns jsonb
language plpgsql stable set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Europe/Sarajevo')::date;
begin
  if not private.actor_has_unscoped_capability(p_actor, 'students.view_progress') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return (
    select coalesce(jsonb_agg(r order by r ->> 'name'), '[]'::jsonb)
    from (
      select jsonb_build_object(
        'person_id', pe.id, 'name', pr.display_name, 'status', pr.account_status,
        'last_activity', (select max(pa.submitted_at) from public.practice_answers pa where pa.person_id = pe.id),
        'days_7', (select count(distinct (pa.submitted_at at time zone 'Europe/Sarajevo')::date) from public.practice_answers pa
                   where pa.person_id = pe.id and (pa.submitted_at at time zone 'Europe/Sarajevo')::date > v_today - 7),
        'days_30', (select count(distinct (pa.submitted_at at time zone 'Europe/Sarajevo')::date) from public.practice_answers pa
                    where pa.person_id = pe.id and (pa.submitted_at at time zone 'Europe/Sarajevo')::date > v_today - 30),
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
          from public.subjects s)) as r
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
begin
  if not private.actor_has_unscoped_capability(p_actor, 'students.view_progress') then
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
  values (p_actor, 'support.profile_viewed', 'persons', p_person::text, '{}'::jsonb, p_ip);

  return jsonb_build_object(
    'person_id', p_person,
    'name', v_name,
    'last_activity', (select max(pa.submitted_at) from public.practice_answers pa where pa.person_id = p_person),
    'days', (select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'answers', d.n) order by d.day), '[]'::jsonb)
             from (select (pa.submitted_at at time zone 'Europe/Sarajevo')::date as day, count(*) as n from public.practice_answers pa
                   where pa.person_id = p_person and (pa.submitted_at at time zone 'Europe/Sarajevo')::date > v_today - 60 group by 1) d),
    'missions_30', (select count(*) from (select (pa.submitted_at at time zone 'Europe/Sarajevo')::date as day from public.practice_answers pa
                    where pa.person_id = p_person and (pa.submitted_at at time zone 'Europe/Sarajevo')::date > v_today - 30
                    group by 1 having count(*) >= p_mission_goal) m),
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
      from public.subjects s),
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
begin
  if not private.actor_has_unscoped_capability(p_actor, 'students.view_progress') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'students', (select count(*) from public.profiles where role = 'student' and account_status = 'active'),
    'weeks', (
      select coalesce(jsonb_agg(jsonb_build_object('week', w.week, 'students', w.students, 'answers', w.answers) order by w.week), '[]'::jsonb)
      from (select date_trunc('week', pa.submitted_at at time zone 'Europe/Sarajevo')::date as week, count(distinct pa.person_id) as students, count(*) as answers
            from public.practice_answers pa where pa.submitted_at > now() - interval '12 weeks' group by 1) w),
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
            group by 1, 2, 3) a),
    'exam_points', (
      select coalesce(jsonb_agg(jsonb_build_object('subject', x.code, 'points', x.points, 'exams', x.n) order by x.code, x.points), '[]'::jsonb)
      from (select s.code, floor(e.total_points)::integer as points, count(*) as n
            from public.mock_exams e join public.subjects s on s.id = e.subject_id where e.status = 'graded' group by 1, 2) x),
    'missed_questions', (
      select coalesce(jsonb_agg(jsonb_build_object('subject', m.code, 'record_key', m.record_key, 'wrong', m.wrong, 'students', m.students) order by m.wrong desc, m.record_key), '[]'::jsonb)
      from (select s.code, ir.record_key, count(*) as wrong, count(distinct pa.person_id) as students
            from public.practice_answers pa
            join public.question_versions qv on qv.id = pa.question_version_id
            join public.ingested_records ir on ir.id = qv.record_id
            join public.subjects s on s.id = pa.subject_id
            where private.practice_outcome(pa.id) = 'incorrect'
            group by 1, 2 order by 3 desc limit 15) m));
end;
$$;
revoke all on function public.support_patterns(uuid) from public, anon, authenticated;
grant execute on function public.support_patterns(uuid) to service_role;
