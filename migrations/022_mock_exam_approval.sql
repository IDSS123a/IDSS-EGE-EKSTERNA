-- Migration: 022_mock_exam_approval
-- Date: 2026-10-03
-- Author: ACA (Claude Code)
-- Description: Canon fidelity part 3 (P-15, PDL-027).
--   * Mock exams: a generated set waits for a teacher of the subject (awaiting_approval), who sees every question with
--     its printed key, errata and open follow-ups and approves it (approved) or discards it (discarded, optionally with
--     a new set); the student starts an approved set, which starts the official duration (in_progress). Before the
--     start the student sees no question.
--   * Scoring precision: Mathematics positions scored by parts allow half points only for tasks printed with parts;
--     matching units keep a correct_pairs column (graded by pairs in 023).
-- Rollback:
--   re-apply private.mock_exam_generate, private.mock_exam_payload, private.mock_exams_frozen,
--   private.mock_exam_items_frozen, public.mock_exam_start, public.mock_exam_overview, public.grading_queue,
--   public.grading_view, public.grading_save (019); drop function if exists public.mock_exam_begin(uuid, uuid, inet),
--   public.mock_exam_approve(uuid, uuid, inet), public.mock_exam_discard(uuid, uuid, text, boolean, inet),
--   private.mock_exam_create(uuid, uuid); alter table public.mock_exam_items drop column correct_pairs; restore the 019
--   mock_exams columns, default and checks (no rows existed when 022 was applied).

-- ---------------------------------------------------------------------------- mock exams: approval flow
-- awaiting_approval -> approved (teacher) -> in_progress (student starts; the official duration runs) -> submitted
-- -> graded; a teacher may discard a set before it is started (discarded).
drop index public.mock_exams_one_open_idx;
alter table public.mock_exams drop constraint mock_exams_status_check;
alter table public.mock_exams drop constraint mock_exams_check;
alter table public.mock_exams
  add column created_at timestamptz not null default now(),
  add column approved_by uuid references public.profiles (user_id) on delete restrict,
  add column approved_at timestamptz,
  add column discarded_by uuid references public.profiles (user_id) on delete restrict,
  add column discarded_at timestamptz,
  add column discard_note text check (length(discard_note) <= 2000),
  alter column status set default 'awaiting_approval',
  alter column started_at drop not null,
  alter column started_at drop default,
  alter column deadline_at drop not null,
  add constraint mock_exams_status_check check (status in ('awaiting_approval', 'approved', 'in_progress', 'submitted', 'graded', 'discarded')),
  add constraint mock_exams_started_check check (status in ('awaiting_approval', 'approved', 'discarded') or (started_at is not null and deadline_at is not null and approved_at is not null)),
  add constraint mock_exams_submitted_check check (status not in ('submitted', 'graded') or submitted_at is not null),
  add constraint mock_exams_approved_check check (status = 'awaiting_approval' or status = 'discarded' or (approved_by is not null and approved_at is not null));
create unique index mock_exams_one_open_idx on public.mock_exams (person_id, subject_id) where status in ('awaiting_approval', 'approved', 'in_progress');
create index mock_exams_approved_by_idx on public.mock_exams (approved_by);
create index mock_exams_discarded_by_idx on public.mock_exams (discarded_by);

create or replace function private.mock_exams_frozen()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'DELETE' or old.status in ('graded', 'discarded') then
    raise exception 'FROZEN' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function private.mock_exam_items_frozen()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'FROZEN' using errcode = '42501';
  end if;
  if (select status from public.mock_exams where id = old.mock_exam_id) in ('graded', 'discarded') then
    raise exception 'FROZEN' using errcode = '42501';
  end if;
  return new;
end;
$$;

alter table public.mock_exam_items
  add column correct_pairs integer check (correct_pairs between 0 and 10);

-- Generation: Mathematics positions scored by parts allow half points only for tasks printed with parts a) and b);
-- B/H/S matching keeps the rule's points (graded by correct pairs).
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

  for v_position in select p from jsonb_array_elements(v_blueprint -> 'positions') p order by (p ->> 'position')::integer loop
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

-- A new set for the person and subject, waiting for a teacher's approval.
create or replace function private.mock_exam_create(p_person uuid, p_subject_id uuid)
returns uuid
language plpgsql set search_path = ''
as $$
declare
  v_blueprint public.exam_blueprints%rowtype;
  v_id        uuid;
  v_max       numeric;
begin
  v_blueprint := private.exam_blueprint(p_subject_id);
  if v_blueprint.id is null then
    raise exception 'NO_BLUEPRINT' using errcode = 'P0002';
  end if;
  if (private.exam_rule(p_subject_id, 'exam.duration_minutes') ->> 'minutes') is null then
    raise exception 'NO_RULE' using errcode = 'P0002';
  end if;
  insert into public.mock_exams (person_id, subject_id, blueprint_id) values (p_person, p_subject_id, v_blueprint.id) returning id into v_id;
  v_max := private.mock_exam_generate(v_id);
  update public.mock_exams set max_points = v_max where id = v_id;
  return v_id;
end;
$$;
revoke all on function private.mock_exam_create(uuid, uuid) from public, anon, authenticated;
grant execute on function private.mock_exam_create(uuid, uuid) to service_role;

-- The student asks for a mock exam: returns the open one (awaiting approval, approved or in progress), else a new set
-- that waits for a teacher. An exam in progress past its deadline is submitted first.
create or replace function public.mock_exam_start(p_actor uuid, p_subject_id uuid, p_ip inet)
returns uuid
language plpgsql set search_path = ''
as $$
declare
  v_person uuid;
  v_open   public.mock_exams%rowtype;
  v_id     uuid;
begin
  v_person := private.practice_person(p_actor);
  if p_subject_id is null or not exists (select 1 from public.subjects where id = p_subject_id) then
    raise exception 'VALIDATION' using errcode = '22023';
  end if;
  select * into v_open from public.mock_exams
  where person_id = v_person and subject_id = p_subject_id and status in ('awaiting_approval', 'approved', 'in_progress') for update;
  if found then
    if v_open.status <> 'in_progress' or v_open.deadline_at > now() then
      return v_open.id;
    end if;
    perform private.mock_exam_close(v_open.id, true);
  end if;
  v_id := private.mock_exam_create(v_person, p_subject_id);
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address)
  values (p_actor, 'exam.requested', 'mock_exams', v_id::text, jsonb_build_object('subject_id', p_subject_id), p_ip);
  return v_id;
end;
$$;

-- The student starts an approved set: the official duration runs from now.
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
  v_minutes := (private.exam_rule(v_exam.subject_id, 'exam.duration_minutes') ->> 'minutes')::integer;
  if v_minutes is null or v_minutes not between 1 and 300 then
    raise exception 'NO_RULE' using errcode = 'P0002';
  end if;
  update public.mock_exams set status = 'in_progress', started_at = now(), deadline_at = now() + make_interval(mins => v_minutes)
  where id = v_exam.id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address)
  values (p_actor, 'exam.started', 'mock_exams', v_exam.id::text, jsonb_build_object('minutes', v_minutes), p_ip);
end;
$$;
revoke all on function public.mock_exam_begin(uuid, uuid, inet) from public, anon, authenticated;
grant execute on function public.mock_exam_begin(uuid, uuid, inet) to service_role;

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
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address)
  values (p_actor, 'exam.set_approved', 'mock_exams', v_exam.id::text, '{}'::jsonb, p_ip);
end;
$$;
revoke all on function public.mock_exam_approve(uuid, uuid, inet) from public, anon, authenticated;
grant execute on function public.mock_exam_approve(uuid, uuid, inet) to service_role;

-- Discards a set before the student starts it; p_new: generate a new set for the same student at once.
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
    v_new := private.mock_exam_create(v_exam.person_id, v_exam.subject_id);
  end if;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address)
  values (p_actor, 'exam.set_discarded', 'mock_exams', v_exam.id::text, jsonb_build_object('new_set', v_new), p_ip);
  return v_new;
end;
$$;
revoke all on function public.mock_exam_discard(uuid, uuid, text, boolean, inet) from public, anon, authenticated;
grant execute on function public.mock_exam_discard(uuid, uuid, text, boolean, inet) to service_role;
