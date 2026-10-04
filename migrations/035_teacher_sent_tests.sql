-- Migration: 035_teacher_sent_tests
-- Date: 2026-10-04
-- Author: ACA (Claude Code)
-- Description: Teacher-led tests (PDL-043, decisions T1 to T6; docs/architecture/TEACHER_LED_TESTS.md).
--   * A subject teacher (exams.grade) sends a whole mock exam or a part of it (chosen positions of the confirmed
--     blueprint) to all active students or to chosen ones (mock_exam_send). Every recipient gets an own set composed
--     exactly as the blueprint prescribes (P-15), limited to the chosen positions for a part; the set waits for the
--     teacher's approval as today (T4); the student is told when the teacher approves it.
--   * Time (T3): a whole test keeps the official duration; for a part the teacher sets the minutes.
--   * Students may still request a mock exam themselves (T1). A student with an open mock exam in the subject is
--     skipped and named in the result (one open exam per student and subject, as before).
--   * A part never counts as a full mock exam (T5): no readiness indicator, no first mock exam or all subjects badge,
--     no submission bonus, not in the trend of the latest exams or in the points distributions; IDSS points for the
--     answered points stay.
--   * Notice kind mock_exam_assigned needs migration 036 (DROP CONSTRAINT, run by the Director); until then the
--     notice is skipped quietly and Web Push still informs the student.
-- Rollback:
--   re-apply the 022/023/025/026/027/033 definitions of the functions replaced here;
--   drop function if exists public.mock_exam_send(uuid, uuid, text, integer[], integer, text, uuid[], inet),
--     public.mock_exam_send_options(uuid, uuid), public.mock_exam_sends_overview(uuid), public.push_targets_of_exam(uuid),
--     private.mock_exam_assigned_notify(uuid), private.mock_exam_create(uuid, uuid, text, integer[], integer, uuid, uuid);
--   alter table public.mock_exams drop column send_id, drop column sent_by, drop column duration_minutes,
--     drop column positions, drop column kind; drop table public.mock_exam_sends.

-- ---------------------------------------------------------------------------- sends and exam columns
create table public.mock_exam_sends (
  id               uuid primary key default gen_random_uuid(),
  subject_id       uuid not null references public.subjects (id) on delete restrict,
  kind             text not null check (kind in ('full', 'part')),
  positions        integer[],
  duration_minutes integer check (duration_minutes between 1 and 300),
  note             text check (length(note) <= 1000),
  sent_by          uuid not null references public.profiles (user_id) on delete restrict,
  audience         text not null check (audience in ('all', 'chosen')),
  created_at       timestamptz not null default now(),
  check ((kind = 'full' and positions is null and duration_minutes is null)
      or (kind = 'part' and cardinality(positions) between 1 and 30 and duration_minutes is not null))
);
create index mock_exam_sends_subject_idx on public.mock_exam_sends (subject_id, created_at desc);
create index mock_exam_sends_sent_by_idx on public.mock_exam_sends (sent_by);
create trigger mock_exam_sends_append_only before update or delete on public.mock_exam_sends
  for each row execute function public.reject_audit_mutation();
alter table public.mock_exam_sends enable row level security;
create policy mock_exam_sends_select on public.mock_exam_sends for select to authenticated using (
  private.has_capability('exams.grade', subject_id));

alter table public.mock_exams
  add column kind text not null default 'full' check (kind in ('full', 'part')),
  add column positions integer[],
  add column duration_minutes integer check (duration_minutes between 1 and 300),
  add column sent_by uuid references public.profiles (user_id) on delete restrict,
  add column send_id uuid references public.mock_exam_sends (id) on delete restrict,
  add constraint mock_exams_part_check check ((kind = 'full' and positions is null and duration_minutes is null)
      or (kind = 'part' and cardinality(positions) between 1 and 30 and duration_minutes is not null));
create index mock_exams_sent_by_idx on public.mock_exams (sent_by);
create index mock_exams_send_idx on public.mock_exams (send_id);

-- ---------------------------------------------------------------------------- composition
create or replace function private.mock_exam_generate(p_exam_id uuid)
returns numeric
language plpgsql set search_path = ''
as $$
declare
  v_exam      public.mock_exams%rowtype;
  v_blueprint jsonb;
  v_position  jsonb;
  v_used      uuid[] := '{}';
  v_areas     uuid[] := '{}';
  v_sequence  integer := 0;
  v_pick      record;
  v_question  jsonb;
  v_item      jsonb;
  v_units     integer;
  v_unit      integer;
  v_allowed   numeric[];
  v_max       numeric;
  v_distinct  boolean;
  v_chosen    bigint;
begin
  select * into v_exam from public.mock_exams where id = p_exam_id;
  select content into v_blueprint from public.exam_blueprints where id = v_exam.blueprint_id;
  v_distinct := coalesce((v_blueprint ->> 'distinct_area')::boolean, false);

  -- A part (PDL-043) uses only the chosen positions; each is filled exactly as the blueprint prescribes.
  for v_position in select p from jsonb_array_elements(v_blueprint -> 'positions') p
                    where v_exam.positions is null or (p ->> 'position')::integer = any (v_exam.positions)
                    order by (p ->> 'position')::integer loop
    v_units := case when v_position ->> 'format' = 'items' then (v_position ->> 'items')::integer else 1 end;
    for v_unit in 1 .. v_units loop
      select qv.id, qv.area_id, jsonb_array_length(qv.sub_parts) as parts into v_pick
      from public.question_versions qv
      join public.questions q on q.id = qv.question_id
      join public.canonical_document_versions dv on dv.id = qv.document_version_id and dv.status = 'active'
      where qv.subject_id = v_exam.subject_id and qv.trust_status = 'trusted'
        and qv.id <> all (v_used)
        and (not v_distinct or qv.area_id is null or qv.area_id <> all (v_areas))
        and exists (
          select 1 from jsonb_array_elements(v_position -> 'pool') pl
          where q.stable_key ~ (pl ->> 'key')
            and substring(q.stable_key from (pl ->> 'key'))::integer between (pl ->> 'from')::integer and (pl ->> 'to')::integer)
      order by (select count(*) from public.mock_exam_items mi join public.mock_exams me on me.id = mi.mock_exam_id
                where me.person_id = v_exam.person_id and me.status <> 'discarded' and mi.question_version_id = qv.id),
               random()
      limit 1;
      if not found then
        raise exception 'BLUEPRINT_UNFILLABLE' using errcode = 'P0002', detail = format('position %s', v_position ->> 'position');
      end if;
      v_used := v_used || v_pick.id;
      if v_pick.area_id is not null then
        v_areas := v_areas || v_pick.area_id;
      end if;
      v_question := private.practice_question(v_pick.id);
      v_chosen := case when v_position ->> 'format' = 'items' then 1 + floor(random() * jsonb_array_length(v_question -> 'items'))::bigint else 1 end;

      for v_item in
        select i from jsonb_array_elements(v_question -> 'items') with ordinality as x (i, n)
        where v_position ->> 'format' = 'task'
           or (v_position ->> 'format' <> 'task' and n = v_chosen)
      loop
        v_sequence := v_sequence + 1;
        v_max := case when v_position ->> 'scoring' = 'per_item' then (v_position ->> 'item_points')::numeric else (v_position ->> 'points')::numeric end;
        v_allowed := case v_position ->> 'scoring'
          when 'parts' then case when v_pick.parts >= 2
            then array[0, (v_position ->> 'part_points')::numeric, 2 * (v_position ->> 'part_points')::numeric]
            else array[0, v_max] end
          when 'matching' then (select array_agg(distinct value::numeric order by value::numeric)
                                from jsonb_each_text(private.exam_rule(v_exam.subject_id, 'exam.scoring') -> 'matching_points_by_correct_pairs'))
          else array[0, v_max] end;
        insert into public.mock_exam_items (mock_exam_id, subject_id, position, sequence, question_version_id, item_number, format, scoring, mode, max_points, allowed_points)
        values (v_exam.id, v_exam.subject_id, (v_position ->> 'position')::integer, v_sequence, v_pick.id,
                case when v_position ->> 'format' in ('task', 'items') then (v_item ->> 'item')::integer end,
                v_position ->> 'format', v_position ->> 'scoring',
                case when v_position ->> 'format' in ('task', 'items') or jsonb_array_length(v_question -> 'items') = 1 then v_item ->> 'mode' else 'open' end,
                v_max, coalesce(v_allowed, array[0, v_max]));
      end loop;
    end loop;
  end loop;
  return (select coalesce(sum(max_points), 0) from public.mock_exam_items where mock_exam_id = v_exam.id);
end;
$$;

-- A new set for the person and subject, waiting for a teacher's approval: a whole test, or a part (chosen positions of
-- the confirmed blueprint) with the teacher's minutes; p_sent_by and p_send mark a set the teacher sent.
create or replace function private.mock_exam_create(p_person uuid, p_subject_id uuid, p_kind text, p_positions integer[],
  p_minutes integer, p_sent_by uuid, p_send uuid)
returns uuid
language plpgsql set search_path = ''
as $$
declare
  v_blueprint public.exam_blueprints%rowtype;
  v_id        uuid;
  v_max       numeric;
  v_positions integer[];
begin
  v_blueprint := private.exam_blueprint(p_subject_id);
  if v_blueprint.id is null then
    raise exception 'NO_BLUEPRINT' using errcode = 'P0002';
  end if;
  if (private.exam_rule(p_subject_id, 'exam.duration_minutes') ->> 'minutes') is null then
    raise exception 'NO_RULE' using errcode = 'P0002';
  end if;
  if p_kind = 'part' then
    select array_agg(distinct x order by x) into v_positions from unnest(p_positions) x;
    if v_positions is null or p_minutes is null or p_minutes not between 1 and 300
       or exists (select 1 from unnest(v_positions) x where not exists (
         select 1 from jsonb_array_elements(v_blueprint.content -> 'positions') p where (p ->> 'position')::integer = x)) then
      raise exception 'VALIDATION' using errcode = '22023';
    end if;
  elsif p_kind is distinct from 'full' or p_positions is not null or p_minutes is not null then
    raise exception 'VALIDATION' using errcode = '22023';
  end if;
  insert into public.mock_exams (person_id, subject_id, blueprint_id, kind, positions, duration_minutes, sent_by, send_id)
  values (p_person, p_subject_id, v_blueprint.id, p_kind, v_positions, case when p_kind = 'part' then p_minutes end, p_sent_by, p_send)
  returning id into v_id;
  v_max := private.mock_exam_generate(v_id);
  update public.mock_exams set max_points = v_max where id = v_id;
  return v_id;
end;
$$;
revoke all on function private.mock_exam_create(uuid, uuid, text, integer[], integer, uuid, uuid) from public, anon, authenticated;
grant execute on function private.mock_exam_create(uuid, uuid, text, integer[], integer, uuid, uuid) to service_role;

-- The student's own request (T1): a whole test, as before.
create or replace function private.mock_exam_create(p_person uuid, p_subject_id uuid)
returns uuid
language sql set search_path = ''
as $$
  select private.mock_exam_create(p_person, p_subject_id, 'full', null, null, null, null)
$$;

-- ---------------------------------------------------------------------------- notices
create or replace function private.mock_exam_assigned_notify(p_exam uuid)
returns void
language plpgsql set search_path = ''
as $$
begin
  insert into public.notifications (recipient_user_id, kind, entity_id, payload)
  select pe.profile_user_id, 'mock_exam_assigned', e.id, jsonb_build_object('subject_id', e.subject_id, 'kind', e.kind)
  from public.mock_exams e join public.persons pe on pe.id = e.person_id
  where e.id = p_exam;
exception when check_violation then
  -- Migration 036 (run by the Director) allows the kind; until then the in-app notice is skipped.
  null;
end;
$$;
revoke all on function private.mock_exam_assigned_notify(uuid) from public, anon, authenticated;
grant execute on function private.mock_exam_assigned_notify(uuid) to service_role;

create or replace function public.push_targets_of_exam(p_exam uuid)
returns jsonb
language sql stable set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('endpoint', ps.endpoint, 'p256dh', ps.p256dh, 'auth', ps.auth, 'kind', e.kind)), '[]'::jsonb)
  from public.mock_exams e
  join public.persons pe on pe.id = e.person_id
  join public.profiles p on p.user_id = pe.profile_user_id and p.account_status = 'active'
  join public.push_subscriptions ps on ps.user_id = p.user_id
  where e.id = p_exam and e.sent_by is not null and e.status = 'approved';
$$;
revoke all on function public.push_targets_of_exam(uuid) from public, anon, authenticated;
grant execute on function public.push_targets_of_exam(uuid) to service_role;

-- ---------------------------------------------------------------------------- teacher: send
-- What the teacher can send in a subject: the confirmed blueprint's positions (format, points, the catalogue areas
-- their tasks come from), the official minutes, and whether the blueprint is confirmed at all.
create or replace function public.mock_exam_send_options(p_actor uuid, p_subject_id uuid)
returns jsonb
language plpgsql stable set search_path = ''
as $$
declare
  v_blueprint public.exam_blueprints%rowtype;
begin
  if not private.actor_has_subject_capability(p_actor, 'exams.grade', p_subject_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  v_blueprint := private.exam_blueprint(p_subject_id);
  return jsonb_build_object(
    'available', v_blueprint.id is not null,
    'minutes', (private.exam_rule(p_subject_id, 'exam.duration_minutes') ->> 'minutes')::integer,
    'total_points', (private.exam_rule(p_subject_id, 'exam.total_points') ->> 'points')::numeric,
    'positions', case when v_blueprint.id is null then '[]'::jsonb else (
      select coalesce(jsonb_agg(jsonb_build_object(
               'position', (p ->> 'position')::integer, 'format', p ->> 'format', 'points', (p ->> 'points')::numeric,
               'areas', (select coalesce(jsonb_agg(distinct jsonb_build_object('id', sa.id, 'name', sa.label)), '[]'::jsonb)
                         from public.question_versions qv
                         join public.questions q on q.id = qv.question_id
                         join public.canonical_document_versions dv on dv.id = qv.document_version_id and dv.status = 'active'
                         join public.subject_areas sa on sa.id = qv.area_id
                         where qv.subject_id = p_subject_id
                           and exists (select 1 from jsonb_array_elements(p -> 'pool') pl
                                       where q.stable_key ~ (pl ->> 'key')
                                         and substring(q.stable_key from (pl ->> 'key'))::integer between (pl ->> 'from')::integer and (pl ->> 'to')::integer)))
             order by (p ->> 'position')::integer), '[]'::jsonb)
      from jsonb_array_elements(v_blueprint.content -> 'positions') p) end);
end;
$$;
revoke all on function public.mock_exam_send_options(uuid, uuid) from public, anon, authenticated;
grant execute on function public.mock_exam_send_options(uuid, uuid) to service_role;

-- Sends a whole test (p_kind 'full', official minutes) or a part (p_kind 'part', chosen positions, the teacher's
-- minutes) to all active students (p_persons null) or to the chosen ones. Returns the send, the sets created and the
-- students skipped because they already have an open mock exam in the subject.
create or replace function public.mock_exam_send(p_actor uuid, p_subject_id uuid, p_kind text, p_positions integer[],
  p_minutes integer, p_note text, p_persons uuid[], p_ip inet)
returns jsonb
language plpgsql set search_path = ''
as $$
declare
  v_persons uuid[];
  v_send    uuid;
  v_person  uuid;
  v_created integer := 0;
  v_skipped text[] := '{}';
begin
  if p_subject_id is null or not private.actor_has_subject_capability(p_actor, 'exams.grade', p_subject_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_kind is null or p_kind not in ('full', 'part') or length(coalesce(p_note, '')) > 1000
     or (p_kind = 'full' and (p_positions is not null or p_minutes is not null))
     or (p_kind = 'part' and (coalesce(cardinality(p_positions), 0) not between 1 and 30 or p_minutes is null or p_minutes not between 1 and 300)) then
    raise exception 'VALIDATION' using errcode = '22023';
  end if;
  if (private.exam_blueprint(p_subject_id)).id is null then
    raise exception 'NO_BLUEPRINT' using errcode = 'P0002';
  end if;

  if p_persons is null then
    select array_agg(pe.id order by pe.id) into v_persons from public.persons pe join public.profiles pr on pr.user_id = pe.profile_user_id
    where pr.role = 'student' and pr.account_status = 'active';
  else
    if cardinality(p_persons) not between 1 and 500
       or exists (select 1 from unnest(p_persons) x(id) where not exists (
         select 1 from public.persons pe join public.profiles pr on pr.user_id = pe.profile_user_id
         where pe.id = x.id and pr.role = 'student' and pr.account_status = 'active')) then
      raise exception 'VALIDATION' using errcode = '22023';
    end if;
    select array_agg(distinct id) into v_persons from unnest(p_persons) id;
  end if;
  if v_persons is null then
    raise exception 'NO_STUDENTS' using errcode = '22023';
  end if;

  insert into public.mock_exam_sends (subject_id, kind, positions, duration_minutes, note, sent_by, audience)
  values (p_subject_id, p_kind, case when p_kind = 'part' then (select array_agg(distinct x order by x) from unnest(p_positions) x) end,
          case when p_kind = 'part' then p_minutes end, nullif(btrim(coalesce(p_note, '')), ''), p_actor,
          case when p_persons is null then 'all' else 'chosen' end)
  returning id into v_send;

  foreach v_person in array v_persons loop
    if exists (select 1 from public.mock_exams e where e.person_id = v_person and e.subject_id = p_subject_id
               and e.status in ('awaiting_approval', 'approved', 'in_progress')) then
      v_skipped := v_skipped || (select pr.display_name from public.persons pe join public.profiles pr on pr.user_id = pe.profile_user_id where pe.id = v_person);
    else
      perform private.mock_exam_create(v_person, p_subject_id, p_kind, p_positions, p_minutes, p_actor, v_send);
      v_created := v_created + 1;
    end if;
  end loop;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address)
  values (p_actor, 'exam.sent', 'mock_exam_sends', v_send::text,
          jsonb_build_object('kind', p_kind, 'positions', to_jsonb(p_positions), 'minutes', p_minutes,
                             'created', v_created, 'skipped', cardinality(v_skipped)), p_ip);
  return jsonb_build_object('send_id', v_send, 'created', v_created, 'skipped', to_jsonb(v_skipped));
end;
$$;
revoke all on function public.mock_exam_send(uuid, uuid, text, integer[], integer, text, uuid[], inet) from public, anon, authenticated;
grant execute on function public.mock_exam_send(uuid, uuid, text, integer[], integer, text, uuid[], inet) to service_role;

-- The teacher's sent tests of the subjects they grade, newest first, with the state of every set.
create or replace function public.mock_exam_sends_overview(p_actor uuid)
returns jsonb
language plpgsql stable set search_path = ''
as $$
begin
  if not private.actor_has_capability(p_actor, 'exams.grade') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', ms.id, 'subject_code', s.code, 'kind', ms.kind, 'positions', to_jsonb(ms.positions),
             'minutes', ms.duration_minutes, 'note', ms.note, 'audience', ms.audience, 'created_at', ms.created_at,
             'sent_by', pr.display_name,
             'states', (select coalesce(jsonb_object_agg(x.status, x.n), '{}'::jsonb)
                        from (select e.status, count(*) as n from public.mock_exams e where e.send_id = ms.id group by 1) x),
             'sets', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'student', sp.display_name, 'status', e.status,
                                                                   'points', e.total_points, 'max', e.max_points) order by sp.display_name), '[]'::jsonb)
                      from public.mock_exams e join public.persons pe on pe.id = e.person_id
                      join public.profiles sp on sp.user_id = pe.profile_user_id where e.send_id = ms.id))
           order by ms.created_at desc), '[]'::jsonb)
    from (select * from public.mock_exam_sends m where private.actor_has_subject_capability(p_actor, 'exams.grade', m.subject_id)
          order by m.created_at desc limit 50) ms
    join public.subjects s on s.id = ms.subject_id
    join public.profiles pr on pr.user_id = ms.sent_by);
end;
$$;
revoke all on function public.mock_exam_sends_overview(uuid) from public, anon, authenticated;
grant execute on function public.mock_exam_sends_overview(uuid) to service_role;

-- ---------------------------------------------------------------------------- existing flow, extended
create or replace function public.mock_exam_begin(p_actor uuid, p_exam_id uuid, p_ip inet)
returns void
language plpgsql set search_path = ''
as $$
declare
  v_person  uuid;
  v_exam    public.mock_exams%rowtype;
  v_minutes integer;
begin
  v_person := private.practice_person(p_actor);
  select * into v_exam from public.mock_exams where id = p_exam_id and person_id = v_person for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_exam.status <> 'approved' then
    raise exception 'NOT_APPROVED' using errcode = '22023';
  end if;
  -- A part runs for the teacher's minutes (T3); a whole test for the official duration.
  v_minutes := coalesce(v_exam.duration_minutes, (private.exam_rule(v_exam.subject_id, 'exam.duration_minutes') ->> 'minutes')::integer);
  if v_minutes is null or v_minutes not between 1 and 300 then
    raise exception 'NO_RULE' using errcode = 'P0002';
  end if;
  update public.mock_exams set status = 'in_progress', started_at = now(), deadline_at = now() + make_interval(mins => v_minutes)
  where id = v_exam.id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address)
  values (p_actor, 'exam.started', 'mock_exams', v_exam.id::text, jsonb_build_object('minutes', v_minutes), p_ip);
end;
$$;

create or replace function public.mock_exam_approve(p_actor uuid, p_exam_id uuid, p_ip inet)
returns void
language plpgsql set search_path = ''
as $$
declare
  v_exam public.mock_exams%rowtype;
begin
  select * into v_exam from public.mock_exams where id = p_exam_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if not private.actor_has_subject_capability(p_actor, 'exams.grade', v_exam.subject_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if v_exam.status <> 'awaiting_approval' then
    raise exception 'CLOSED' using errcode = '22023';
  end if;
  update public.mock_exams set status = 'approved', approved_by = p_actor, approved_at = now() where id = v_exam.id;
  -- A set the teacher sent becomes visible now: the student is told (T4).
  if v_exam.sent_by is not null then
    perform private.mock_exam_assigned_notify(v_exam.id);
  end if;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address)
  values (p_actor, 'exam.set_approved', 'mock_exams', v_exam.id::text, '{}'::jsonb, p_ip);
end;
$$;

create or replace function public.mock_exam_discard(p_actor uuid, p_exam_id uuid, p_note text, p_new boolean, p_ip inet)
returns uuid
language plpgsql set search_path = ''
as $$
declare
  v_exam public.mock_exams%rowtype;
  v_new  uuid;
begin
  select * into v_exam from public.mock_exams where id = p_exam_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if not private.actor_has_subject_capability(p_actor, 'exams.grade', v_exam.subject_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if v_exam.status not in ('awaiting_approval', 'approved') then
    raise exception 'CLOSED' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_note, ''))) not between 1 and 2000 then
    raise exception 'VALIDATION' using errcode = '22023';
  end if;
  update public.mock_exams set status = 'discarded', discarded_by = p_actor, discarded_at = now(), discard_note = btrim(p_note)
  where id = v_exam.id;
  if coalesce(p_new, false) then
    -- The new set keeps what the teacher sent: whole or part, positions and minutes.
    v_new := private.mock_exam_create(v_exam.person_id, v_exam.subject_id, v_exam.kind, v_exam.positions,
                                      v_exam.duration_minutes, v_exam.sent_by, v_exam.send_id);
  end if;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address)
  values (p_actor, 'exam.set_discarded', 'mock_exams', v_exam.id::text, jsonb_build_object('new_set', v_new), p_ip);
  return v_new;
end;
$$;

create or replace function public.mock_exam_overview(p_actor uuid)
returns jsonb
language plpgsql set search_path = ''
as $$
declare
  v_person uuid;
  v_id     uuid;
begin
  v_person := private.practice_person(p_actor);
  for v_id in select id from public.mock_exams where person_id = v_person and status = 'in_progress' and deadline_at <= now() loop
    perform private.mock_exam_close(v_id, true);
  end loop;
  return jsonb_build_object(
    'subjects', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'subject_id', s.id, 'subject_code', s.code,
               'available', (private.exam_blueprint(s.id)).id is not null,
               'minutes', (private.exam_rule(s.id, 'exam.duration_minutes') ->> 'minutes')::integer,
               'total_points', (private.exam_rule(s.id, 'exam.total_points') ->> 'points')::numeric,
               'open_exam_id', (select e.id from public.mock_exams e where e.person_id = v_person and e.subject_id = s.id and e.status in ('awaiting_approval', 'approved', 'in_progress')),
               'open_status', (select e.status from public.mock_exams e where e.person_id = v_person and e.subject_id = s.id and e.status in ('awaiting_approval', 'approved', 'in_progress')),
               'open_kind', (select e.kind from public.mock_exams e where e.person_id = v_person and e.subject_id = s.id and e.status in ('awaiting_approval', 'approved', 'in_progress')),
               'open_sent', (select e.sent_by is not null from public.mock_exams e where e.person_id = v_person and e.subject_id = s.id and e.status in ('awaiting_approval', 'approved', 'in_progress')))
             order by s.code), '[]'::jsonb)
      from public.subjects s),
    'exams', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', e.id, 'subject_code', s.code, 'status', e.status, 'kind', e.kind, 'positions', to_jsonb(e.positions), 'sent', e.sent_by is not null, 'created_at', e.created_at, 'started_at', e.started_at,
               'submitted_at', e.submitted_at, 'graded_at', e.graded_at, 'max_points', e.max_points,
               'total_points', case when e.status = 'graded' then e.total_points end)
             order by e.created_at desc), '[]'::jsonb)
      from (select * from public.mock_exams where person_id = v_person and status <> 'discarded' order by created_at desc limit 50) e
      join public.subjects s on s.id = e.subject_id));
end;
$$;

create or replace function public.grading_queue(p_actor uuid)
returns jsonb
language plpgsql set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not private.actor_has_capability(p_actor, 'exams.grade') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  for v_id in select id from public.mock_exams e where e.status = 'in_progress' and e.deadline_at <= now()
              and private.actor_has_subject_capability(p_actor, 'exams.grade', e.subject_id) loop
    perform private.mock_exam_close(v_id, true);
  end loop;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', e.id, 'subject_id', e.subject_id, 'subject_code', s.code, 'student', pr.display_name, 'status', e.status,
             'kind', e.kind, 'positions', to_jsonb(e.positions), 'sent', e.sent_by is not null,
             'created_at', e.created_at, 'submitted_at', e.submitted_at, 'auto_submitted', e.auto_submitted, 'graded_at', e.graded_at,
             'max_points', e.max_points, 'total_points', e.total_points,
             'units', (select count(*) from public.mock_exam_items mi where mi.mock_exam_id = e.id),
             'ungraded', (select count(*) from public.mock_exam_items mi where mi.mock_exam_id = e.id and coalesce(mi.final_points, mi.proposed_points) is null))
           order by case e.status when 'awaiting_approval' then 0 when 'submitted' then 1 else 2 end, coalesce(e.submitted_at, e.created_at)), '[]'::jsonb)
    from public.mock_exams e
    join public.subjects s on s.id = e.subject_id
    join public.persons pe on pe.id = e.person_id
    join public.profiles pr on pr.user_id = pe.profile_user_id
    where (e.status in ('awaiting_approval', 'submitted') or (e.status = 'graded' and e.graded_at > now() - interval '30 days'))
      and private.actor_has_subject_capability(p_actor, 'exams.grade', e.subject_id));
end;
$$;

create or replace function private.mock_exam_payload(p_exam_id uuid, p_staff boolean)
returns jsonb
language plpgsql stable set search_path = ''
as $$
declare
  v_exam     public.mock_exams%rowtype;
  v_released boolean;
  v_visible  boolean;
begin
  select * into v_exam from public.mock_exams where id = p_exam_id;
  v_released := p_staff or v_exam.status = 'graded';
  v_visible := p_staff or v_exam.status in ('in_progress', 'submitted', 'graded');
  return jsonb_build_object(
    'id', v_exam.id,
    'subject_id', v_exam.subject_id,
    'subject_code', (select code from public.subjects where id = v_exam.subject_id),
    'student', case when p_staff then (select pr.display_name from public.persons pe join public.profiles pr on pr.user_id = pe.profile_user_id where pe.id = v_exam.person_id) end,
    'status', v_exam.status,
    'created_at', v_exam.created_at,
    'approved_at', v_exam.approved_at,
    'started_at', v_exam.started_at,
    'deadline_at', v_exam.deadline_at,
    'submitted_at', v_exam.submitted_at,
    'auto_submitted', v_exam.auto_submitted,
    'graded_at', v_exam.graded_at,
    'max_points', v_exam.max_points,
    'minutes', coalesce(v_exam.duration_minutes, (private.exam_rule(v_exam.subject_id, 'exam.duration_minutes') ->> 'minutes')::integer),
    'kind', v_exam.kind,
    'positions', to_jsonb(v_exam.positions),
    'sent_by', (select display_name from public.profiles where user_id = v_exam.sent_by),
    'note', (select note from public.mock_exam_sends where id = v_exam.send_id),
    'total_points', case when v_released then v_exam.total_points end,
    'server_now', now(),
    'items', case when v_visible then (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', mi.id, 'position', mi.position, 'sequence', mi.sequence, 'question_version_id', mi.question_version_id,
               'item', mi.item_number, 'format', mi.format, 'scoring', mi.scoring, 'mode', mi.mode, 'max_points', mi.max_points,
               'allowed_points', to_jsonb(mi.allowed_points), 'response', mi.response,
               'proposed_points', case when p_staff then mi.proposed_points end,
               'correct_pairs', case when v_released then mi.correct_pairs end,
               'final_points', case when v_released then mi.final_points end,
               'note', case when v_released then mi.note end,
               'solution', case when v_released then private.effective_key(k.id) end)
             order by mi.sequence), '[]'::jsonb)
      from public.mock_exam_items mi
      left join public.answer_keys k on k.question_version_id = mi.question_version_id and k.item_number is not distinct from mi.item_number
      where mi.mock_exam_id = v_exam.id) else '[]'::jsonb end,
    'questions', case when v_visible then (
      select coalesce(jsonb_object_agg(q.id, private.practice_question(q.id)
               || jsonb_build_object('errata', private.question_errata(q.id, v_released))
               || case when p_staff then jsonb_build_object('follow_ups', (
                    select coalesce(jsonb_agg(jsonb_build_object('assignee', f.assignee, 'note', f.note, 'opened_at', f.opened_at)), '[]'::jsonb)
                    from public.canon_follow_ups f
                    where f.question_version_id = q.id and not exists (select 1 from public.canon_follow_up_resolutions r where r.follow_up_id = f.id)))
                  else '{}'::jsonb end), '{}'::jsonb)
      from (select distinct question_version_id as id from public.mock_exam_items where mock_exam_id = v_exam.id) q) else '{}'::jsonb end);
end;
$$;

-- ---------------------------------------------------------------------------- a part never counts as a full mock exam (T5)
create or replace function private.support_readiness(p_person uuid, p_subject uuid)
returns jsonb
language sql stable set search_path = ''
as $$
  with recent as (
    select e.id from public.mock_exams e
    where e.person_id = p_person and e.subject_id = p_subject and e.status = 'graded' and e.kind = 'full'
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
    select e.subject_id, e.status, e.total_points, e.kind from public.mock_exams e
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
      'exams_submitted', (select count(*) from exams where kind = 'full') * (v_xp ->> 'mock_exam_submitted')::numeric,
      'exams_graded', (select coalesce(sum(least((v_xp ->> 'mock_exam_points_cap')::numeric, coalesce(total_points, 0) * (v_xp ->> 'mock_exam_point')::numeric)), 0)
                       from exams where status = 'graded')),
    'badges', jsonb_build_object(
      'first_answer', exists (select 1 from answers),
      'streak', coalesce((select max(length) from runs), 0) >= (v_badges ->> 'streak_days')::integer,
      'answers_in_subject', (select coalesce(jsonb_agg(code order by code), '[]'::jsonb) from subject_answers where n >= (v_badges ->> 'answers_in_subject')::integer),
      'first_mock_exam', (select coalesce(jsonb_agg(distinct s.code), '[]'::jsonb) from exams x join public.subjects s on s.id = x.subject_id where x.kind = 'full'),
      'all_subjects', (select count(distinct subject_id) from exams where kind = 'full') >= (select count(*) from public.subjects)))
  into v_result;
  return v_result;
end;
$$;

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
                             from (select * from public.mock_exams e where e.person_id = pe.id and e.subject_id = s.id and e.status = 'graded' and e.kind = 'full' order by e.graded_at desc limit 2) e),
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
                          'id', e.id, 'kind', e.kind, 'positions', to_jsonb(e.positions), 'sent', e.sent_by is not null,
                          'status', e.status, 'submitted_at', e.submitted_at, 'graded_at', e.graded_at,
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
            from public.mock_exams e join public.subjects s on s.id = e.subject_id where e.status = 'graded' and e.kind = 'full' and (v_scope is null or e.subject_id = any(v_scope)) group by 1, 2) x),
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
                          where e2.subject_id = s.id and e2.status = 'graded' and e2.kind = 'full' and e2.graded_at >= p_since group by 1) p) end
          from public.mock_exams e where e.subject_id = s.id and e.status = 'graded' and e.kind = 'full' and e.graded_at >= p_since),
        'graded_exams', (select count(*) from public.mock_exams e where e.subject_id = s.id and e.status = 'graded' and e.kind = 'full' and e.graded_at >= p_since)) as j
      from public.subjects s
      cross join lateral (
        select count(distinct pa.person_id) as students, count(distinct pa.question_version_id) as covered,
               count(*) filter (where private.practice_outcome(pa.id) in ('correct', 'partly_correct', 'incorrect')) as checked,
               count(*) filter (where private.practice_outcome(pa.id) = 'correct') as correct
        from public.practice_answers pa where pa.subject_id = s.id and pa.submitted_at >= p_since) st) x);
end;
$$;
