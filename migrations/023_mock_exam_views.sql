-- Migration: 023_mock_exam_views
-- Date: 2026-10-03
-- Author: ACA (Claude Code)
-- Description: Canon fidelity part 4 (P-15, PDL-027), continues 022. Mock exam payload (no question before the student
--   starts; staff see printed keys, errata and open follow-ups; errata descriptions for the student once released),
--   overview, teacher queue with sets awaiting approval, grading view, and grading by correct pairs for matching units.
-- Rollback: re-apply private.mock_exam_payload, public.mock_exam_overview, public.grading_queue, public.grading_view,
--   public.grading_save (019).

-- Payload: before the student starts, a student sees status only (no question). Staff see every question with its
-- printed key, errata with descriptions and open follow-ups. A student sees errata descriptions once released.
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
    'minutes', (private.exam_rule(v_exam.subject_id, 'exam.duration_minutes') ->> 'minutes')::integer,
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
               'open_status', (select e.status from public.mock_exams e where e.person_id = v_person and e.subject_id = s.id and e.status in ('awaiting_approval', 'approved', 'in_progress')))
             order by s.code), '[]'::jsonb)
      from public.subjects s),
    'exams', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', e.id, 'subject_code', s.code, 'status', e.status, 'created_at', e.created_at, 'started_at', e.started_at,
               'submitted_at', e.submitted_at, 'graded_at', e.graded_at, 'max_points', e.max_points,
               'total_points', case when e.status = 'graded' then e.total_points end)
             order by e.created_at desc), '[]'::jsonb)
      from (select * from public.mock_exams where person_id = v_person and status <> 'discarded' order by created_at desc limit 50) e
      join public.subjects s on s.id = e.subject_id));
end;
$$;

-- Teacher queue: sets waiting for approval, submitted exams to grade, and recently graded ones.
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

create or replace function public.grading_view(p_actor uuid, p_exam_id uuid)
returns jsonb
language plpgsql set search_path = ''
as $$
declare
  v_exam public.mock_exams%rowtype;
begin
  select * into v_exam from public.mock_exams where id = p_exam_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if not private.actor_has_subject_capability(p_actor, 'exams.grade', v_exam.subject_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if v_exam.status = 'in_progress' then
    if v_exam.deadline_at > now() then
      raise exception 'IN_PROGRESS' using errcode = '22023';
    end if;
    perform private.mock_exam_close(v_exam.id, true);
  end if;
  return private.mock_exam_payload(v_exam.id, true);
end;
$$;

-- p_scores: [{id, points | pairs, note}]. Matching units take the number of correct pairs (converted by the confirmed
-- rule exam.scoring.matching_points_by_correct_pairs); other units take points the unit allows. null clears a grade.
create or replace function public.grading_save(p_actor uuid, p_exam_id uuid, p_scores jsonb, p_ip inet)
returns integer
language plpgsql set search_path = ''
as $$
declare
  v_exam  public.mock_exams%rowtype;
  v_rule  jsonb;
  v_count integer;
begin
  select * into v_exam from public.mock_exams where id = p_exam_id for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if not private.actor_has_subject_capability(p_actor, 'exams.grade', v_exam.subject_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if v_exam.status <> 'submitted' then
    raise exception 'CLOSED' using errcode = '22023';
  end if;
  v_rule := private.exam_rule(v_exam.subject_id, 'exam.scoring') -> 'matching_points_by_correct_pairs';
  if p_scores is null or jsonb_typeof(p_scores) <> 'array' or jsonb_array_length(p_scores) not between 1 and 60
     or exists (
       select 1 from jsonb_array_elements(p_scores) s
       left join public.mock_exam_items mi on mi.mock_exam_id = v_exam.id and mi.id::text = s ->> 'id'
       where mi.id is null
          or (s ? 'note' and jsonb_typeof(s -> 'note') not in ('string', 'null'))
          or length(coalesce(s ->> 'note', '')) > 2000
          or (mi.scoring = 'matching' and (s ? 'points'
                or (jsonb_typeof(s -> 'pairs') is distinct from 'null' and jsonb_typeof(s -> 'pairs') is distinct from 'number')
                or (jsonb_typeof(s -> 'pairs') = 'number' and (v_rule is null or not (v_rule ? (s ->> 'pairs'))))))
          or (mi.scoring <> 'matching' and (s ? 'pairs'
                or (jsonb_typeof(s -> 'points') is distinct from 'null' and jsonb_typeof(s -> 'points') is distinct from 'number')
                or (jsonb_typeof(s -> 'points') = 'number' and not ((s ->> 'points')::numeric = any (mi.allowed_points))))))
  then
    raise exception 'VALIDATION' using errcode = '22023';
  end if;
  update public.mock_exam_items mi
  set correct_pairs = case when mi.scoring = 'matching' then (s ->> 'pairs')::integer end,
      final_points = case when mi.scoring = 'matching' then (v_rule ->> (s ->> 'pairs'))::numeric else (s ->> 'points')::numeric end,
      note = nullif(btrim(coalesce(s ->> 'note', '')), ''),
      graded_by = p_actor,
      graded_at = now()
  from jsonb_array_elements(p_scores) s
  where mi.mock_exam_id = v_exam.id and mi.id::text = s ->> 'id';
  get diagnostics v_count = row_count;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address)
  values (p_actor, 'exam.graded_units', 'mock_exams', v_exam.id::text, jsonb_build_object('units', v_count), p_ip);
  return v_count;
end;
$$;
