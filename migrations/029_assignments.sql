-- Migration: 029_assignments
-- Date: 2026-10-03
-- Author: ACA (Claude Code)
-- Description: Sprint 09, teacher assignments (PDL-035, docs/architecture/ASSIGNMENTS.md). A teacher with
--   assignments.manage for a subject gives trusted catalogue questions of that subject (picked by key, or N drawn from
--   an area) to all active students or to chosen students, with a required due date. Completion: every assigned
--   question answered after the assignment was created, whatever the outcome (Z3). No IDSS points of its own (Z5).
--   Append-only; a withdrawal is a new row with a reason. The student reaches the questions only through functions.
--   private.assignment_notify is a no-op here; migration 030 (run by the Director: notification kind constraint)
--   turns it into an in-app notification per recipient.
-- Rollback:
--   drop function if exists public.assignment_create(uuid, text, text, text, timestamptz, text[], uuid, integer, uuid[], inet),
--     public.assignment_withdraw(uuid, uuid, text, inet), public.assignments_overview(uuid), public.assignment_detail(uuid, uuid),
--     public.student_assignments(uuid), public.assignment_next(uuid, uuid), public.assignments_of_person(uuid, uuid),
--     private.assignment_status(uuid, uuid), private.assignment_notify(uuid);
--   drop table if exists public.assignment_withdrawals, public.assignment_recipients, public.assignment_questions, public.assignments;

create table public.assignments (
  id          uuid primary key default gen_random_uuid(),
  subject_id  uuid not null references public.subjects (id) on delete restrict,
  author      uuid not null references public.profiles (user_id) on delete restrict,
  title       text not null check (length(btrim(title)) between 1 and 120),
  instruction text check (instruction is null or length(instruction) <= 1000),
  due_at      timestamptz not null,
  audience    text not null check (audience in ('all', 'chosen')),
  created_at  timestamptz not null default now()
);
create table public.assignment_questions (
  assignment_id       uuid not null references public.assignments (id) on delete restrict,
  question_version_id uuid not null references public.question_versions (id) on delete restrict,
  position            integer not null check (position >= 1),
  primary key (assignment_id, question_version_id)
);
create table public.assignment_recipients (
  assignment_id uuid not null references public.assignments (id) on delete restrict,
  person_id     uuid not null references public.persons (id) on delete restrict,
  primary key (assignment_id, person_id)
);
create table public.assignment_withdrawals (
  assignment_id uuid primary key references public.assignments (id) on delete restrict,
  withdrawn_by  uuid not null references public.profiles (user_id) on delete restrict,
  reason        text not null check (length(btrim(reason)) between 1 and 500),
  withdrawn_at  timestamptz not null default now()
);
create index assignments_subject_idx on public.assignments (subject_id, created_at desc);
create index assignments_author_idx on public.assignments (author);
create index assignment_questions_question_idx on public.assignment_questions (question_version_id);
create index assignment_recipients_person_idx on public.assignment_recipients (person_id);
create index assignment_withdrawals_by_idx on public.assignment_withdrawals (withdrawn_by);
create trigger assignments_append_only before update or delete on public.assignments
  for each row execute function public.reject_audit_mutation();
create trigger assignment_questions_append_only before update or delete on public.assignment_questions
  for each row execute function public.reject_audit_mutation();
create trigger assignment_recipients_append_only before update or delete on public.assignment_recipients
  for each row execute function public.reject_audit_mutation();
create trigger assignment_withdrawals_append_only before update or delete on public.assignment_withdrawals
  for each row execute function public.reject_audit_mutation();
alter table public.assignments enable row level security;
alter table public.assignment_questions enable row level security;
alter table public.assignment_recipients enable row level security;
alter table public.assignment_withdrawals enable row level security;
-- Staff of the subject read directly; students only through the functions below.
create policy assignments_select on public.assignments for select to authenticated using (
  private.has_capability('assignments.manage', subject_id) or private.has_capability('students.view_progress', subject_id));
create policy assignment_questions_select on public.assignment_questions for select to authenticated using (
  exists (select 1 from public.assignments a where a.id = assignment_id
          and (private.has_capability('assignments.manage', a.subject_id) or private.has_capability('students.view_progress', a.subject_id))));
create policy assignment_recipients_select on public.assignment_recipients for select to authenticated using (
  exists (select 1 from public.assignments a where a.id = assignment_id
          and (private.has_capability('assignments.manage', a.subject_id) or private.has_capability('students.view_progress', a.subject_id))));
create policy assignment_withdrawals_select on public.assignment_withdrawals for select to authenticated using (
  exists (select 1 from public.assignments a where a.id = assignment_id
          and (private.has_capability('assignments.manage', a.subject_id) or private.has_capability('students.view_progress', a.subject_id))));

-- Notice to the recipients: a no-op until migration 030 (notification kind 'assignment_given').
create or replace function private.assignment_notify(p_assignment uuid)
returns void
language sql set search_path = ''
as $$ select $$;
revoke all on function private.assignment_notify(uuid) from public, anon, authenticated;
grant execute on function private.assignment_notify(uuid) to service_role;

-- Facts of one recipient (Z3): answered = questions with an answer given at or after the assignment's creation;
-- correct = of those, the latest such answer is correct; state open, complete (by the due date), late, missed, withdrawn.
create or replace function private.assignment_status(p_assignment uuid, p_person uuid)
returns jsonb
language sql stable set search_path = ''
as $$
  with a as (select * from public.assignments where id = p_assignment),
  per_question as (
    select aq.question_version_id,
           (select min(pa.submitted_at) from public.practice_answers pa, a
             where pa.person_id = p_person and pa.question_version_id = aq.question_version_id and pa.submitted_at >= a.created_at) as first_at,
           (select private.practice_outcome(pa.id) from public.practice_answers pa, a
             where pa.person_id = p_person and pa.question_version_id = aq.question_version_id and pa.submitted_at >= a.created_at
             order by pa.submitted_at desc limit 1) as latest
    from public.assignment_questions aq where aq.assignment_id = p_assignment
  ), counted as (
    select count(*) as total, count(first_at) as answered, count(*) filter (where latest = 'correct') as correct,
           case when count(first_at) = count(*) then max(first_at) end as completed_at
    from per_question
  )
  select jsonb_build_object('total', c.total, 'answered', c.answered, 'correct', c.correct, 'completed_at', c.completed_at,
    'state', case
      when exists (select 1 from public.assignment_withdrawals w where w.assignment_id = p_assignment) then 'withdrawn'
      when c.completed_at is not null and c.completed_at <= a.due_at then 'complete'
      when c.completed_at is not null then 'late'
      when now() > a.due_at then 'missed'
      else 'open' end)
  from counted c, a
$$;
revoke all on function private.assignment_status(uuid, uuid) from public, anon, authenticated;
grant execute on function private.assignment_status(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------- create, withdraw
create or replace function public.assignment_create(p_actor uuid, p_subject text, p_title text, p_instruction text, p_due timestamptz,
  p_keys text[], p_area uuid, p_count integer, p_persons uuid[], p_ip inet)
returns uuid
language plpgsql set search_path = ''
as $$
declare
  v_subject   uuid;
  v_id        uuid;
  v_questions uuid[];
  v_persons   uuid[];
begin
  select id into v_subject from public.subjects where code = p_subject;
  if v_subject is null then
    raise exception 'VALIDATION' using errcode = '22023';
  end if;
  if not private.actor_has_subject_capability(p_actor, 'assignments.manage', v_subject) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_title, ''))) not between 1 and 120 or length(coalesce(p_instruction, '')) > 1000
     or p_due is null or p_due <= now() or p_due > now() + interval '366 days' then
    raise exception 'VALIDATION' using errcode = '22023';
  end if;

  -- Content (Z2): picked keys, or N drawn from one area; trusted questions of the subject's active catalogue only.
  if coalesce(cardinality(p_keys), 0) > 0 then
    if cardinality(p_keys) > 50 or p_area is not null then
      raise exception 'VALIDATION' using errcode = '22023';
    end if;
    -- One trusted version per distinct key, in the order the teacher gave them.
    with keys as (
      select upper(btrim(key)) as key, min(ord) as ord from unnest(p_keys) with ordinality k(key, ord) group by 1
    )
    select array_agg(q.id order by keys.ord) into v_questions
    from keys
    cross join lateral (
      select qv.id from public.ingested_records ir
      join public.question_versions qv on qv.record_id = ir.id and qv.subject_id = v_subject
      join public.canonical_document_versions v on v.id = qv.document_version_id and v.status = 'active'
      where ir.record_key = keys.key
      order by qv.created_at desc limit 1) q;
    if coalesce(cardinality(v_questions), 0) <> (select count(distinct upper(btrim(key))) from unnest(p_keys) key) then
      raise exception 'UNKNOWN_KEYS' using errcode = '22023';
    end if;
  else
    if p_area is null or p_count is null or p_count not between 1 and 50
       or not exists (select 1 from public.subject_areas where id = p_area and subject_id = v_subject) then
      raise exception 'VALIDATION' using errcode = '22023';
    end if;
    select array_agg(id) into v_questions from (
      select qv.id from public.question_versions qv
      join public.canonical_document_versions v on v.id = qv.document_version_id and v.status = 'active'
      where qv.subject_id = v_subject and qv.area_id = p_area
      order by random() limit p_count) q;
    if v_questions is null then
      raise exception 'VALIDATION' using errcode = '22023';
    end if;
  end if;

  -- Recipients (Z1): all active students, or the chosen ones (each an active student).
  if p_persons is null then
    select array_agg(pe.id) into v_persons from public.persons pe join public.profiles pr on pr.user_id = pe.profile_user_id
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

  insert into public.assignments (subject_id, author, title, instruction, due_at, audience)
  values (v_subject, p_actor, btrim(p_title), nullif(btrim(coalesce(p_instruction, '')), ''), p_due, case when p_persons is null then 'all' else 'chosen' end)
  returning id into v_id;
  insert into public.assignment_questions (assignment_id, question_version_id, position)
  select v_id, q, ord from unnest(v_questions) with ordinality u(q, ord);
  insert into public.assignment_recipients (assignment_id, person_id) select v_id, unnest(v_persons);
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address)
  values (p_actor, 'assignment.created', 'assignments', v_id::text,
          jsonb_build_object('subject', p_subject, 'questions', cardinality(v_questions), 'recipients', cardinality(v_persons)), p_ip);
  perform private.assignment_notify(v_id);
  return v_id;
end;
$$;
revoke all on function public.assignment_create(uuid, text, text, text, timestamptz, text[], uuid, integer, uuid[], inet) from public, anon, authenticated;
grant execute on function public.assignment_create(uuid, text, text, text, timestamptz, text[], uuid, integer, uuid[], inet) to service_role;

create or replace function public.assignment_withdraw(p_actor uuid, p_assignment uuid, p_reason text, p_ip inet)
returns void
language plpgsql set search_path = ''
as $$
declare
  v_subject uuid;
begin
  select subject_id into v_subject from public.assignments where id = p_assignment;
  if v_subject is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if not private.actor_has_subject_capability(p_actor, 'assignments.manage', v_subject) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_reason, ''))) not between 1 and 500 then
    raise exception 'VALIDATION' using errcode = '22023';
  end if;
  if exists (select 1 from public.assignment_withdrawals where assignment_id = p_assignment) then
    raise exception 'ALREADY_WITHDRAWN' using errcode = '22023';
  end if;
  insert into public.assignment_withdrawals (assignment_id, withdrawn_by, reason) values (p_assignment, p_actor, btrim(p_reason));
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address)
  values (p_actor, 'assignment.withdrawn', 'assignments', p_assignment::text, '{}'::jsonb, p_ip);
end;
$$;
revoke all on function public.assignment_withdraw(uuid, uuid, text, inet) from public, anon, authenticated;
grant execute on function public.assignment_withdraw(uuid, uuid, text, inet) to service_role;

-- ---------------------------------------------------------------------------- staff views
-- Assignments of the subjects where the actor manages assignments, newest first, with counts per state.
create or replace function public.assignments_overview(p_actor uuid)
returns jsonb
language plpgsql stable set search_path = ''
as $$
begin
  if not private.actor_has_capability(p_actor, 'assignments.manage') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', a.id, 'subject', s.code, 'title', a.title, 'due_at', a.due_at, 'created_at', a.created_at, 'audience', a.audience,
             'author', pr.display_name,
             'questions', (select count(*) from public.assignment_questions q where q.assignment_id = a.id),
             'withdrawn', exists (select 1 from public.assignment_withdrawals w where w.assignment_id = a.id),
             'states', (select coalesce(jsonb_object_agg(x.state, x.n), '{}'::jsonb) from (
                          select private.assignment_status(a.id, r.person_id) ->> 'state' as state, count(*) as n
                          from public.assignment_recipients r where r.assignment_id = a.id group by 1) x))
           order by a.created_at desc), '[]'::jsonb)
    from public.assignments a
    join public.subjects s on s.id = a.subject_id
    join public.profiles pr on pr.user_id = a.author
    where private.actor_has_subject_capability(p_actor, 'assignments.manage', a.subject_id));
end;
$$;
revoke all on function public.assignments_overview(uuid) from public, anon, authenticated;
grant execute on function public.assignments_overview(uuid) to service_role;

-- One assignment with its questions and the facts of every recipient.
create or replace function public.assignment_detail(p_actor uuid, p_assignment uuid)
returns jsonb
language plpgsql stable set search_path = ''
as $$
declare
  v_subject uuid;
begin
  select subject_id into v_subject from public.assignments where id = p_assignment;
  if v_subject is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if not private.actor_has_subject_capability(p_actor, 'assignments.manage', v_subject) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'id', a.id, 'subject', s.code, 'title', a.title, 'instruction', a.instruction, 'due_at', a.due_at, 'created_at', a.created_at,
      'audience', a.audience, 'author', pr.display_name,
      'withdrawal', (select jsonb_build_object('reason', w.reason, 'at', w.withdrawn_at) from public.assignment_withdrawals w where w.assignment_id = a.id),
      'questions', (select coalesce(jsonb_agg(jsonb_build_object('id', q.question_version_id, 'key', ir.record_key) order by q.position), '[]'::jsonb)
                    from public.assignment_questions q
                    join public.question_versions qv on qv.id = q.question_version_id
                    join public.ingested_records ir on ir.id = qv.record_id
                    where q.assignment_id = a.id),
      'recipients', (select coalesce(jsonb_agg(jsonb_build_object('person_id', r.person_id, 'name', sp.display_name)
                                                 || private.assignment_status(a.id, r.person_id) order by sp.display_name), '[]'::jsonb)
                     from public.assignment_recipients r
                     join public.persons pe on pe.id = r.person_id
                     join public.profiles sp on sp.user_id = pe.profile_user_id
                     where r.assignment_id = a.id))
    from public.assignments a
    join public.subjects s on s.id = a.subject_id
    join public.profiles pr on pr.user_id = a.author
    where a.id = p_assignment);
end;
$$;
revoke all on function public.assignment_detail(uuid, uuid) from public, anon, authenticated;
grant execute on function public.assignment_detail(uuid, uuid) to service_role;

-- Assignments of one student in the reader's progress scope (profile: completed and missed, mandate §11).
create or replace function public.assignments_of_person(p_actor uuid, p_person uuid)
returns jsonb
language plpgsql stable set search_path = ''
as $$
declare
  v_scope uuid[] := private.actor_progress_subjects(p_actor);
begin
  if v_scope is not null and cardinality(v_scope) = 0 then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'subject', s.code, 'title', a.title, 'due_at', a.due_at, 'author', pr.display_name)
                              || private.assignment_status(a.id, p_person) order by a.due_at desc), '[]'::jsonb)
    from public.assignment_recipients r
    join public.assignments a on a.id = r.assignment_id
    join public.subjects s on s.id = a.subject_id
    join public.profiles pr on pr.user_id = a.author
    where r.person_id = p_person and (v_scope is null or a.subject_id = any(v_scope)));
end;
$$;
revoke all on function public.assignments_of_person(uuid, uuid) from public, anon, authenticated;
grant execute on function public.assignments_of_person(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------- student
-- The student's own assignments that are not withdrawn: open ones first by due date, then the rest.
create or replace function public.student_assignments(p_actor uuid)
returns jsonb
language plpgsql stable set search_path = ''
as $$
declare
  v_person uuid := private.practice_person(p_actor);
begin
  return (
    select coalesce(jsonb_agg(x.j order by (x.j ->> 'state') not in ('open', 'missed'), (x.j ->> 'due_at')::timestamptz), '[]'::jsonb)
    from (
      select jsonb_build_object('id', a.id, 'subject', s.code, 'title', a.title, 'instruction', a.instruction, 'due_at', a.due_at,
                                'teacher', pr.display_name) || private.assignment_status(a.id, v_person) as j
      from public.assignment_recipients r
      join public.assignments a on a.id = r.assignment_id
      join public.subjects s on s.id = a.subject_id
      join public.profiles pr on pr.user_id = a.author
      where r.person_id = v_person and not exists (select 1 from public.assignment_withdrawals w where w.assignment_id = a.id)) x);
end;
$$;
revoke all on function public.student_assignments(uuid) from public, anon, authenticated;
grant execute on function public.student_assignments(uuid) to service_role;

-- The next question of an assignment the student has not yet answered since it was given; null when complete.
create or replace function public.assignment_next(p_actor uuid, p_assignment uuid)
returns jsonb
language plpgsql set search_path = ''
as $$
declare
  v_person  uuid := private.practice_person(p_actor);
  v_version uuid;
begin
  if not exists (select 1 from public.assignment_recipients r where r.assignment_id = p_assignment and r.person_id = v_person)
     or exists (select 1 from public.assignment_withdrawals w where w.assignment_id = p_assignment) then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  select q.question_version_id into v_version
  from public.assignment_questions q
  join public.assignments a on a.id = q.assignment_id
  where q.assignment_id = p_assignment
    and not exists (select 1 from public.practice_answers pa where pa.person_id = v_person
                    and pa.question_version_id = q.question_version_id and pa.submitted_at >= a.created_at)
  order by q.position limit 1;
  if v_version is null then
    return null;
  end if;
  return private.practice_question(v_version);
end;
$$;
revoke all on function public.assignment_next(uuid, uuid) from public, anon, authenticated;
grant execute on function public.assignment_next(uuid, uuid) to service_role;
