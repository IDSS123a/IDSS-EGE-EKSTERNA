-- Migration: 033_director_command_center
-- Date: 2026-10-04
-- Author: ACA (Claude Code)
-- Description: Sprint 10 (PDL-040, docs/architecture/DIRECTOR_COMMAND_CENTER.md). Read-only institution views for
--   analytics.view_institution: overview, subjects, teachers (K1: counts of completed work by name, no times), content
--   health, system health; the audit log for audit.view (K4: read, filter, export). K2: any figure built from fewer
--   distinct students than the Director's minimum group (setting privacy.min_group, 3) is returned as null. K3: every
--   view takes the start of its period. K5: settings the Director owns (daily mission goal, IDSS points and badge
--   values, minimum group) with validation and audit (before and after); exam rules stay canon (P-15).
-- Rollback:
--   drop function if exists public.director_overview(uuid, timestamptz), public.director_subjects(uuid, timestamptz),
--     public.director_teachers(uuid, timestamptz), public.director_content(uuid), public.director_system(uuid),
--     public.director_audit(uuid, text, uuid, timestamptz, timestamptz, integer, integer), public.set_setting(uuid, text, jsonb, inet),
--     public.settings_history(uuid, text), private.min_group(), private.director_check(uuid, timestamptz);
--   delete from public.system_settings where key in ('mission.daily_goal', 'privacy.min_group', 'gamification.values');

-- ---------------------------------------------------------------------------- settings (K5)
-- Defaults are the values approved so far: mission goal 5 (PDL-024), IDSS points and badges (PDL-029), minimum group 3
-- (Director, K2).
insert into public.system_settings (key, value) values
  ('mission.daily_goal', '{"value": 5}'),
  ('privacy.min_group', '{"value": 3}'),
  ('gamification.values', '{"xp": {"answer_correct": 10, "answer_partly_correct": 5, "answer_incorrect": 2, "mission_completed": 20, "practice_day": 5, "mock_exam_submitted": 30, "mock_exam_point": 10, "mock_exam_points_cap": 100}, "badges": {"streak_days": 7, "answers_in_subject": 50}}')
on conflict (key) do nothing;

create or replace function private.min_group()
returns integer
language sql stable security definer set search_path = ''
as $$
  select coalesce((select (value ->> 'value')::integer from public.system_settings where key = 'privacy.min_group'), 3)
$$;
revoke all on function private.min_group() from public, anon, authenticated;
grant execute on function private.min_group() to service_role;

-- Writes one of the Director's settings after validating it; the audit row keeps the value before and after.
create or replace function public.set_setting(p_actor uuid, p_key text, p_value jsonb, p_ip inet)
returns jsonb
language plpgsql set search_path = ''
as $$
declare
  v_before jsonb;
  v_value  jsonb;
  v_names  text[] := array['answer_correct', 'answer_partly_correct', 'answer_incorrect', 'mission_completed', 'practice_day',
                           'mock_exam_submitted', 'mock_exam_point', 'mock_exam_points_cap'];
begin
  if not private.actor_has_capability(p_actor, 'settings.manage') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_key in ('mission.daily_goal', 'privacy.min_group') then
    if jsonb_typeof(p_value -> 'value') is distinct from 'number' or (p_value ->> 'value')::numeric <> floor((p_value ->> 'value')::numeric)
       or (p_value ->> 'value')::integer not between 1 and (case when p_key = 'mission.daily_goal' then 100 else 50 end) then
      raise exception 'VALIDATION' using errcode = '22023';
    end if;
    v_value := jsonb_build_object('value', (p_value ->> 'value')::integer);
  elsif p_key = 'gamification.values' then
    if jsonb_typeof(p_value -> 'xp') is distinct from 'object' or jsonb_typeof(p_value -> 'badges') is distinct from 'object'
       or exists (select 1 from unnest(v_names) n where jsonb_typeof(p_value -> 'xp' -> n) is distinct from 'number' or (p_value -> 'xp' ->> n)::numeric not between 0 and 1000)
       or exists (select 1 from unnest(array['streak_days', 'answers_in_subject']) n
                  where jsonb_typeof(p_value -> 'badges' -> n) is distinct from 'number' or (p_value -> 'badges' ->> n)::numeric <> floor((p_value -> 'badges' ->> n)::numeric)
                     or (p_value -> 'badges' ->> n)::integer not between 1 and 1000) then
      raise exception 'VALIDATION' using errcode = '22023';
    end if;
    v_value := jsonb_build_object(
      'xp', (select jsonb_object_agg(n, (p_value -> 'xp' ->> n)::numeric) from unnest(v_names) n),
      'badges', jsonb_build_object('streak_days', (p_value -> 'badges' ->> 'streak_days')::integer,
                                   'answers_in_subject', (p_value -> 'badges' ->> 'answers_in_subject')::integer));
  else
    raise exception 'VALIDATION' using errcode = '22023';
  end if;
  select value into v_before from public.system_settings where key = p_key;
  insert into public.system_settings (key, value, updated_by, updated_at) values (p_key, v_value, p_actor, now())
  on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address)
  values (p_actor, 'settings.changed', 'system_setting', p_key, jsonb_build_object('before', v_before, 'after', v_value), p_ip);
  return v_value;
end;
$$;
revoke all on function public.set_setting(uuid, text, jsonb, inet) from public, anon, authenticated;
grant execute on function public.set_setting(uuid, text, jsonb, inet) to service_role;

-- The last 20 changes of one setting (from the audit log).
create or replace function public.settings_history(p_actor uuid, p_key text)
returns jsonb
language plpgsql stable set search_path = ''
as $$
begin
  if not private.actor_has_capability(p_actor, 'settings.manage') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object('at', a.occurred_at, 'by', p.display_name, 'before', a.details -> 'before', 'after', a.details -> 'after')
             order by a.occurred_at desc), '[]'::jsonb)
    from (select * from public.audit_logs where entity_type = 'system_setting' and entity_id = p_key order by occurred_at desc limit 20) a
    left join public.profiles p on p.user_id = a.actor_user_id);
end;
$$;
revoke all on function public.settings_history(uuid, text) from public, anon, authenticated;
grant execute on function public.settings_history(uuid, text) to service_role;

-- ---------------------------------------------------------------------------- institution views
create or replace function private.director_check(p_actor uuid, p_since timestamptz)
returns void
language plpgsql stable set search_path = ''
as $$
begin
  if not private.actor_has_capability(p_actor, 'analytics.view_institution') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_since is null or p_since > now() or p_since < now() - interval '731 days' then
    raise exception 'VALIDATION' using errcode = '22023';
  end if;
end;
$$;
revoke all on function private.director_check(uuid, timestamptz) from public, anon, authenticated;
grant execute on function private.director_check(uuid, timestamptz) to service_role;

-- Pregled: participation and activity since p_since.
create or replace function public.director_overview(p_actor uuid, p_since timestamptz)
returns jsonb
language plpgsql stable set search_path = ''
as $$
declare
  v_min       integer := private.min_group();
  v_practised integer;
begin
  perform private.director_check(p_actor, p_since);
  select count(distinct person_id) into v_practised from public.practice_answers where submitted_at >= p_since;
  return jsonb_build_object(
    'min_group', v_min,
    'students_active', (select count(*) from public.profiles where role = 'student' and account_status = 'active'),
    'students_practised', v_practised,
    'answers', case when v_practised >= v_min then (select count(*) from public.practice_answers where submitted_at >= p_since) end,
    'weeks', (select coalesce(jsonb_agg(jsonb_build_object('week', w.week, 'students', w.students,
                'answers', case when w.students >= v_min then w.answers end) order by w.week), '[]'::jsonb)
              from (select date_trunc('week', submitted_at at time zone 'Europe/Sarajevo')::date as week,
                           count(distinct person_id) as students, count(*) as answers
                    from public.practice_answers where submitted_at >= p_since group by 1) w),
    'exams', jsonb_build_object(
      'requested', (select count(*) from public.mock_exams where created_at >= p_since),
      'submitted', (select count(*) from public.mock_exams where submitted_at >= p_since),
      'graded', (select count(*) from public.mock_exams where graded_at >= p_since)),
    'assignments', (select jsonb_build_object('given', count(distinct a.id), 'recipients', count(r.person_id),
                      'states', case when count(distinct r.person_id) >= v_min then (
                        select coalesce(jsonb_object_agg(x.state, x.n), '{}'::jsonb) from (
                          select private.assignment_status(a2.id, r2.person_id) ->> 'state' as state, count(*) as n
                          from public.assignments a2 join public.assignment_recipients r2 on r2.assignment_id = a2.id
                          where a2.created_at >= p_since group by 1) x) end)
                    from public.assignments a left join public.assignment_recipients r on r.assignment_id = a.id
                    where a.created_at >= p_since),
    'gifts', (select count(*) from public.gifts where created_at >= p_since));
end;
$$;
revoke all on function public.director_overview(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.director_overview(uuid, timestamptz) to service_role;

-- Predmeti: per subject, aggregates only; null where fewer students than the minimum group contributed (K2).
create or replace function public.director_subjects(p_actor uuid, p_since timestamptz)
returns jsonb
language plpgsql stable set search_path = ''
as $$
declare
  v_min    integer := private.min_group();
  v_active integer := (select count(*) from public.profiles where role = 'student' and account_status = 'active');
begin
  perform private.director_check(p_actor, p_since);
  return (
    select coalesce(jsonb_agg(x.j order by x.code), '[]'::jsonb)
    from (
      select s.code, jsonb_build_object(
        'code', s.code,
        'trusted', (select count(*) from public.question_versions qv join public.canonical_document_versions v on v.id = qv.document_version_id and v.status = 'active' where qv.subject_id = s.id),
        'students', st.students,
        'covered', case when st.students >= v_min then st.covered end,
        'checked', case when st.students >= v_min then st.checked end,
        'correct', case when st.students >= v_min then st.correct end,
        'readiness', case when v_active >= v_min then (
          select coalesce(jsonb_object_agg(r.state, r.n), '{}'::jsonb) from (
            select private.support_readiness(pe.id, s.id) ->> 'state' as state, count(*) as n
            from public.persons pe join public.profiles pr on pr.user_id = pe.profile_user_id
            where pr.role = 'student' and pr.account_status = 'active' group by 1) r) end,
        'exam_points', (
          select case when count(distinct e.person_id) >= v_min then
                   (select coalesce(jsonb_agg(jsonb_build_object('points', p.points, 'exams', p.n) order by p.points), '[]'::jsonb)
                    from (select floor(e2.total_points)::integer as points, count(*) as n from public.mock_exams e2
                          where e2.subject_id = s.id and e2.status = 'graded' and e2.graded_at >= p_since group by 1) p) end
          from public.mock_exams e where e.subject_id = s.id and e.status = 'graded' and e.graded_at >= p_since),
        'graded_exams', (select count(*) from public.mock_exams e where e.subject_id = s.id and e.status = 'graded' and e.graded_at >= p_since)) as j
      from public.subjects s
      cross join lateral (
        select count(distinct pa.person_id) as students, count(distinct pa.question_version_id) as covered,
               count(*) filter (where private.practice_outcome(pa.id) in ('correct', 'partly_correct', 'incorrect')) as checked,
               count(*) filter (where private.practice_outcome(pa.id) = 'correct') as correct
        from public.practice_answers pa where pa.subject_id = s.id and pa.submitted_at >= p_since) st) x);
end;
$$;
revoke all on function public.director_subjects(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.director_subjects(uuid, timestamptz) to service_role;

-- Nastavnici (K1): completed work per subject teacher since p_since, and the open work of their subjects. No times.
create or replace function public.director_teachers(p_actor uuid, p_since timestamptz)
returns jsonb
language plpgsql stable set search_path = ''
as $$
begin
  perform private.director_check(p_actor, p_since);
  return (
    select coalesce(jsonb_agg(t.j order by t.name), '[]'::jsonb)
    from (
      select p.display_name as name, jsonb_build_object(
        'name', p.display_name,
        'subjects', (select coalesce(jsonb_agg(distinct s.code), '[]'::jsonb) from public.profile_bundles b join public.subjects s on s.id = b.scope_subject_id
                     where b.profile_user_id = p.user_id and b.bundle_code = 'subject_teacher'),
        'records_reviewed', (select count(*) from public.record_reviews where reviewer = p.user_id and decided_at >= p_since),
        'rules_reviewed', (select count(*) from public.canonical_rule_reviews where reviewer = p.user_id and decided_at >= p_since),
        'answers_reviewed', (select count(*) from public.practice_answer_reviews where reviewer = p.user_id and reviewed_at >= p_since),
        'sets_approved', (select count(*) from public.mock_exams where approved_by = p.user_id and approved_at >= p_since),
        'exams_graded', (select count(*) from public.mock_exams where graded_by = p.user_id and graded_at >= p_since),
        'assignments_given', (select count(*) from public.assignments where author = p.user_id and created_at >= p_since),
        'gifts_given', (select count(*) from public.gifts where giver = p.user_id and created_at >= p_since),
        'notes_written', (select count(*) from public.teacher_notes where author = p.user_id and created_at >= p_since),
        'waiting_answers', (select count(*) from public.practice_answers pa
                            where pa.subject_id in (select scope_subject_id from public.profile_bundles where profile_user_id = p.user_id and bundle_code = 'subject_teacher')
                              and private.practice_outcome(pa.id) = 'awaiting_teacher'),
        'waiting_exams', (select count(*) from public.mock_exams e
                          where e.subject_id in (select scope_subject_id from public.profile_bundles where profile_user_id = p.user_id and bundle_code = 'subject_teacher')
                            and e.status in ('awaiting_approval', 'submitted'))) as j
      from public.profiles p
      where p.account_status = 'active'
        and exists (select 1 from public.profile_bundles b where b.profile_user_id = p.user_id and b.bundle_code = 'subject_teacher')) t);
end;
$$;
revoke all on function public.director_teachers(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.director_teachers(uuid, timestamptz) to service_role;

-- Sadržaj: content health per subject (catalogue review, revisions, errata, follow-ups, blueprint, retrieval index,
-- questions most often answered wrongly by at least the minimum group of students).
create or replace function public.director_content(p_actor uuid)
returns jsonb
language plpgsql stable set search_path = ''
as $$
declare
  v_min integer := private.min_group();
begin
  perform private.director_check(p_actor, now());
  return (
    select coalesce(jsonb_agg(x.j order by x.code), '[]'::jsonb)
    from (
      select s.code, jsonb_build_object(
        'code', s.code,
        'records', (select count(*) from public.ingested_records ir where ir.version_id = s.source_version_id
                    and ir.record_kind in ('official_catalogue_question', 'official_catalogue_task')),
        'accepted', (select count(*) from public.question_versions qv join public.canonical_document_versions v on v.id = qv.document_version_id and v.status = 'active' where qv.subject_id = s.id),
        'returned', (select count(*) from (select distinct on (rr.record_id) rr.decision from public.record_reviews rr
                     where rr.subject_id = s.id order by rr.record_id, rr.decided_at desc) l where l.decision = 'returned'),
        'text_revisions', (select count(*) from public.question_text_revisions where subject_id = s.id),
        'errata_open', (select count(*) from public.catalogue_errata e where e.subject_id = s.id and e.withdraws is null
                        and not exists (select 1 from public.catalogue_errata w where w.withdraws = e.id)),
        'follow_ups_open', (select count(*) from public.canon_follow_ups f where f.subject_id = s.id
                            and not exists (select 1 from public.canon_follow_up_resolutions r where r.follow_up_id = f.id)),
        'blueprint', (select jsonb_build_object('version', b.version, 'loaded_at', b.loaded_at,
                        'review', (select jsonb_build_object('decision', r.decision, 'by', pr.display_name, 'at', r.decided_at)
                                   from public.exam_blueprint_reviews r join public.profiles pr on pr.user_id = r.reviewer
                                   where r.blueprint_id = b.id order by r.decided_at desc limit 1))
                      from public.exam_blueprints b where b.subject_id = s.id order by b.loaded_at desc limit 1),
        'chunks', (select count(*) from public.canonical_chunks c where c.subject_id = s.id),
        'embeddings', (select count(*) from public.canonical_chunk_embeddings c where c.subject_id = s.id),
        'missed', (select coalesce(jsonb_agg(jsonb_build_object('key', m.record_key, 'wrong', m.wrong, 'students', m.students) order by m.wrong desc, m.record_key), '[]'::jsonb)
                   from (select ir.record_key, count(*) as wrong, count(distinct pa.person_id) as students
                         from public.practice_answers pa
                         join public.question_versions qv on qv.id = pa.question_version_id
                         join public.ingested_records ir on ir.id = qv.record_id
                         where pa.subject_id = s.id and private.practice_outcome(pa.id) = 'incorrect'
                         group by 1 having count(distinct pa.person_id) >= v_min order by 2 desc limit 10) m)) as j
      from public.subjects s) x);
end;
$$;
revoke all on function public.director_content(uuid) from public, anon, authenticated;
grant execute on function public.director_content(uuid) to service_role;

-- Sistem: ingestion jobs, failed sign-ins of the last 30 days, retrieval index, notification kinds the database allows
-- (shows whether migration 030 ran), last applied migrations.
create or replace function public.director_system(p_actor uuid)
returns jsonb
language plpgsql stable set search_path = ''
as $$
declare
  v_migrations jsonb := '[]'::jsonb;
begin
  perform private.director_check(p_actor, now());
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    execute 'select coalesce(jsonb_agg(jsonb_build_object(''version'', version, ''name'', name) order by version desc), ''[]''::jsonb)
             from (select version, name from supabase_migrations.schema_migrations order by version desc limit 8) m' into v_migrations;
  end if;
  return jsonb_build_object(
    'jobs', (select coalesce(jsonb_agg(jsonb_build_object('state', j.state, 'profile', j.profile_code, 'finished_at', j.finished_at, 'pages', j.page_count) order by j.started_at desc), '[]'::jsonb)
             from (select * from public.canonical_ingestion_jobs order by started_at desc limit 5) j),
    'security', (select coalesce(jsonb_object_agg(k.kind, k.n), '{}'::jsonb)
                 from (select kind, count(*) as n from public.security_events where occurred_at > now() - interval '30 days' group by 1) k),
    'chunks', (select count(*) from public.canonical_chunks),
    'embeddings', (select count(*) from public.canonical_chunk_embeddings),
    'index_built_at', (select max(built_at) from public.canonical_chunks),
    'notification_kinds', (select pg_get_constraintdef(c.oid) from pg_constraint c where c.conrelid = 'public.notifications'::regclass and c.conname = 'notifications_kind_check'),
    'migrations', v_migrations);
end;
$$;
revoke all on function public.director_system(uuid) from public, anon, authenticated;
grant execute on function public.director_system(uuid) to service_role;

-- Dnevnik (K4): the audit log, filtered and paged; details exactly as stored (they never carry note or message content).
create or replace function public.director_audit(p_actor uuid, p_action text, p_person uuid, p_from timestamptz, p_to timestamptz, p_limit integer, p_offset integer)
returns jsonb
language plpgsql stable set search_path = ''
as $$
begin
  if not private.actor_has_capability(p_actor, 'audit.view') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_limit is null or p_limit not between 1 and 5000 or p_offset is null or p_offset < 0 then
    raise exception 'VALIDATION' using errcode = '22023';
  end if;
  return jsonb_build_object(
    'total', (select count(*) from public.audit_logs a
              where (p_action is null or a.action = p_action) and (p_person is null or a.actor_user_id = p_person)
                and (p_from is null or a.occurred_at >= p_from) and (p_to is null or a.occurred_at < p_to)),
    'rows', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'at', a.occurred_at, 'action', a.action, 'actor', p.display_name,
               'entity_type', a.entity_type, 'entity_id', a.entity_id, 'details', a.details, 'ip', host(a.ip_address)) order by a.occurred_at desc, a.id desc), '[]'::jsonb)
             from (select * from public.audit_logs a
                   where (p_action is null or a.action = p_action) and (p_person is null or a.actor_user_id = p_person)
                     and (p_from is null or a.occurred_at >= p_from) and (p_to is null or a.occurred_at < p_to)
                   order by a.occurred_at desc, a.id desc limit p_limit offset p_offset) a
             left join public.profiles p on p.user_id = a.actor_user_id),
    'actions', (select coalesce(jsonb_agg(distinct action order by action), '[]'::jsonb) from public.audit_logs),
    'people', (select coalesce(jsonb_agg(jsonb_build_object('id', p.user_id, 'name', p.display_name) order by p.display_name), '[]'::jsonb)
               from public.profiles p where exists (select 1 from public.audit_logs a where a.actor_user_id = p.user_id)));
end;
$$;
revoke all on function public.director_audit(uuid, text, uuid, timestamptz, timestamptz, integer, integer) from public, anon, authenticated;
grant execute on function public.director_audit(uuid, text, uuid, timestamptz, timestamptz, integer, integer) to service_role;
