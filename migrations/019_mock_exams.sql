-- Migration: 019_mock_exams
-- Date: 2026-09-27
-- Author: ACA (Claude Code)
-- Description: Mock exams and teacher grading (Sprint 07; PDL-018, PDL-026; EXAM_SIMULATION.md).
--   * exam_blueprints: per subject, the positions of the real test and the catalogue tasks that may fill them
--     (config/exam-blueprints.json), loaded by canon.publish; points must add up to the subject's confirmed
--     exam.total_points. exam_blueprint_reviews: a reviewer of the subject confirms or rejects. Both append-only.
--   * mock_exams / mock_exam_items: a generated set bound to the person, one row per gradable unit (a task, a German
--     item). Generation uses trusted questions of active versions only, never twice in one set, unseen tasks first
--     (exposure over earlier mock exams). The deadline is the confirmed exam.duration_minutes; answers are saved while
--     writing; a mock exam past its deadline is closed automatically with the saved answers.
--   * Pre-scoring on submission: choice and true/false units get the effective key's verdict as a proposal (CF-03);
--     empty answers are proposed 0; other units wait for the teacher. The student never reads items, keys or points
--     before the teacher confirms (items are readable by the student only after grading; functions return no key).
--   * Grading: exams.grade (subject teachers, superadmin) grades each unit with the points the rule allows, may change
--     any proposal, and confirms; the result is released on confirmation. Graded exams are frozen.
--   * notifications: in-app messages (teacher: submitted mock exam; student: result released).
--   All write paths are SECURITY INVOKER functions, service_role only, re-checking capabilities; every write audited.
-- Rollback:
--   drop function if exists public.notifications_mark_read(uuid, uuid[]), public.grading_confirm(uuid, uuid, inet),
--     public.grading_save(uuid, uuid, jsonb, inet), public.grading_view(uuid, uuid), public.grading_queue(uuid),
--     public.mock_exam_overview(uuid), public.mock_exam_submit(uuid, uuid, jsonb, inet), public.mock_exam_save(uuid, uuid, jsonb),
--     public.mock_exam_view(uuid, uuid), public.mock_exam_start(uuid, uuid, inet), public.review_exam_blueprint(uuid, uuid, text, text, inet),
--     public.load_exam_blueprint(uuid, text, text, jsonb, text, inet), private.mock_exam_close(uuid, boolean, inet), private.mock_exam_store(uuid, uuid, jsonb), private.mock_exams_frozen(),
--     private.mock_exam_generate(uuid), private.mock_exam_payload(uuid, boolean), private.exam_blueprint(uuid),
--     private.exam_rule(uuid, text), private.mock_exam_items_frozen();
--   drop table if exists public.notifications, public.mock_exam_items, public.mock_exams, public.exam_blueprint_reviews, public.exam_blueprints;
--   delete from public.bundle_capabilities where capability_code = 'exams.grade';
--   delete from public.role_capabilities where capability_code = 'exams.grade';
--   delete from public.capabilities where code = 'exams.grade';

insert into public.capabilities (code, description) values
  ('exams.grade', 'Grade mock exams of the scoped subject and release the results');
insert into public.role_capabilities (role, capability_code) values ('superadmin', 'exams.grade');
insert into public.bundle_capabilities (bundle_code, capability_code) values ('subject_teacher', 'exams.grade');

-- ---------------------------------------------------------------------------- helpers
-- A confirmed canonical rule value of the subject's current catalogue edition.
create or replace function private.exam_rule(p_subject_id uuid, p_code text)
returns jsonb
language sql stable set search_path = ''
as $$
  select r.value from public.canonical_rules r
  join public.subjects s on s.id = r.subject_id and s.source_version_id = r.source_version_id
  where r.subject_id = p_subject_id and r.rule_code = p_code
  order by r.loaded_at desc limit 1
$$;
revoke all on function private.exam_rule(uuid, text) from public, anon, authenticated;
grant execute on function private.exam_rule(uuid, text) to service_role;

-- ---------------------------------------------------------------------------- blueprints
create table public.exam_blueprints (
  id             uuid primary key default gen_random_uuid(),
  subject_id     uuid not null references public.subjects (id) on delete restrict,
  version        text not null check (version ~ '^[0-9A-Za-z.-]{1,40}$'),
  content        jsonb not null check (jsonb_typeof(content -> 'positions') = 'array'),
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  loaded_by      uuid not null references public.profiles (user_id) on delete restrict,
  loaded_at      timestamptz not null default now(),
  unique (subject_id, version)
);
create index exam_blueprints_loaded_by_idx on public.exam_blueprints (loaded_by);

create table public.exam_blueprint_reviews (
  id           uuid primary key default gen_random_uuid(),
  blueprint_id uuid not null references public.exam_blueprints (id) on delete restrict,
  subject_id   uuid not null references public.subjects (id) on delete restrict,
  reviewer     uuid not null references public.profiles (user_id) on delete restrict,
  decision     text not null check (decision in ('confirmed', 'rejected')),
  note         text check (length(note) <= 2000),
  decided_at   timestamptz not null default now(),
  check (decision = 'confirmed' or length(btrim(coalesce(note, ''))) > 0)
);
create index exam_blueprint_reviews_blueprint_idx on public.exam_blueprint_reviews (blueprint_id, decided_at desc);
create index exam_blueprint_reviews_subject_idx on public.exam_blueprint_reviews (subject_id);
create index exam_blueprint_reviews_reviewer_idx on public.exam_blueprint_reviews (reviewer);

create trigger exam_blueprints_append_only before update or delete on public.exam_blueprints
  for each row execute function public.reject_audit_mutation();
create trigger exam_blueprint_reviews_append_only before update or delete on public.exam_blueprint_reviews
  for each row execute function public.reject_audit_mutation();

alter table public.exam_blueprints enable row level security;
alter table public.exam_blueprint_reviews enable row level security;
create policy exam_blueprints_select on public.exam_blueprints for select to authenticated using (
  private.has_capability('canon.publish') or private.has_capability('canon.review', subject_id) or private.has_capability('exams.grade', subject_id));
create policy exam_blueprint_reviews_select on public.exam_blueprint_reviews for select to authenticated using (
  private.has_capability('canon.publish') or private.has_capability('canon.review', subject_id) or private.has_capability('exams.grade', subject_id));

-- The blueprint students get: the newest loaded version whose latest review is a confirmation.
create or replace function private.exam_blueprint(p_subject_id uuid)
returns public.exam_blueprints
language sql stable set search_path = ''
as $$
  select b.* from public.exam_blueprints b
  where b.subject_id = p_subject_id
    and (select r.decision from public.exam_blueprint_reviews r where r.blueprint_id = b.id order by r.decided_at desc limit 1) = 'confirmed'
  order by b.loaded_at desc limit 1
$$;
revoke all on function private.exam_blueprint(uuid) from public, anon, authenticated;
grant execute on function private.exam_blueprint(uuid) to service_role;

-- p_content: one subject's entry of config/exam-blueprints.json ({reviewer, evidence, distinct_area, positions}).
create or replace function public.load_exam_blueprint(p_actor uuid, p_subject_code text, p_version text, p_content jsonb, p_sha256 text, p_ip inet)
returns uuid
language plpgsql set search_path = ''
as $$
declare
  v_subject  uuid;
  v_existing public.exam_blueprints%rowtype;
  v_id       uuid;
  v_total    numeric;
begin
  if not private.actor_has_capability(p_actor, 'canon.publish') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select id into v_subject from public.subjects where code = p_subject_code;
  if v_subject is null or p_version is null or p_version !~ '^[0-9A-Za-z.-]{1,40}$' or p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$'
     or p_content is null or jsonb_typeof(p_content -> 'positions') <> 'array'
     or jsonb_array_length(p_content -> 'positions') not between 1 and 30
     or exists (
       select 1 from jsonb_array_elements(p_content -> 'positions') with ordinality as x (p, n)
       where (p ->> 'position') is distinct from n::text
          or coalesce(p ->> 'format', '') not in ('choice', 'completion', 'matching', 'working', 'task', 'items')
          or coalesce(p ->> 'scoring', '') not in ('single', 'matching', 'parts', 'per_item')
          or jsonb_typeof(p -> 'points') <> 'number' or (p ->> 'points')::numeric <= 0
          or (p ->> 'scoring' = 'per_item' and (jsonb_typeof(p -> 'item_points') <> 'number' or jsonb_typeof(p -> 'items') <> 'number'))
          or (p ->> 'scoring' = 'parts' and jsonb_typeof(p -> 'part_points') <> 'number')
          or jsonb_typeof(p -> 'pool') <> 'array' or jsonb_array_length(p -> 'pool') = 0
          or exists (select 1 from jsonb_array_elements(p -> 'pool') pl
                     where jsonb_typeof(pl -> 'key') <> 'string' or length(pl ->> 'key') > 200
                        or jsonb_typeof(pl -> 'from') <> 'number' or jsonb_typeof(pl -> 'to') <> 'number'))
  then
    raise exception 'VALIDATION' using errcode = '22023';
  end if;
  -- Points are canon: they must add up to the subject's confirmed total.
  select sum((p ->> 'points')::numeric) into v_total from jsonb_array_elements(p_content -> 'positions') p;
  if v_total is distinct from (private.exam_rule(v_subject, 'exam.total_points') ->> 'points')::numeric then
    raise exception 'POINTS_MISMATCH' using errcode = '22023';
  end if;

  select * into v_existing from public.exam_blueprints where subject_id = v_subject and version = p_version;
  if found then
    if v_existing.content_sha256 <> p_sha256 then
      raise exception 'VERSION_EXISTS' using errcode = '23505';
    end if;
    return v_existing.id;
  end if;
  insert into public.exam_blueprints (subject_id, version, content, content_sha256, loaded_by)
  values (v_subject, p_version, p_content, p_sha256, p_actor) returning id into v_id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address)
  values (p_actor, 'exam.blueprint_loaded', 'exam_blueprints', v_id::text,
          jsonb_build_object('subject', p_subject_code, 'version', p_version, 'sha256', p_sha256), p_ip);
  return v_id;
end;
$$;
revoke all on function public.load_exam_blueprint(uuid, text, text, jsonb, text, inet) from public, anon, authenticated;
grant execute on function public.load_exam_blueprint(uuid, text, text, jsonb, text, inet) to service_role;

create or replace function public.review_exam_blueprint(p_actor uuid, p_blueprint_id uuid, p_decision text, p_note text, p_ip inet)
returns void
language plpgsql set search_path = ''
as $$
declare
  v_blueprint public.exam_blueprints%rowtype;
begin
  select * into v_blueprint from public.exam_blueprints where id = p_blueprint_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if not private.actor_has_subject_capability(p_actor, 'canon.review', v_blueprint.subject_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_decision is null or p_decision not in ('confirmed', 'rejected') or length(coalesce(p_note, '')) > 2000
     or (p_decision = 'rejected' and length(btrim(coalesce(p_note, ''))) = 0) then
    raise exception 'VALIDATION' using errcode = '22023';
  end if;
  insert into public.exam_blueprint_reviews (blueprint_id, subject_id, reviewer, decision, note)
  values (v_blueprint.id, v_blueprint.subject_id, p_actor, p_decision, nullif(btrim(coalesce(p_note, '')), ''));
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address)
  values (p_actor, 'exam.blueprint_reviewed', 'exam_blueprints', v_blueprint.id::text, jsonb_build_object('decision', p_decision), p_ip);
end;
$$;
revoke all on function public.review_exam_blueprint(uuid, uuid, text, text, inet) from public, anon, authenticated;
grant execute on function public.review_exam_blueprint(uuid, uuid, text, text, inet) to service_role;

-- ---------------------------------------------------------------------------- mock exams
create table public.mock_exams (
  id             uuid primary key default gen_random_uuid(),
  person_id      uuid not null references public.persons (id) on delete restrict,
  subject_id     uuid not null references public.subjects (id) on delete restrict,
  blueprint_id   uuid not null references public.exam_blueprints (id) on delete restrict,
  status         text not null default 'in_progress' check (status in ('in_progress', 'submitted', 'graded')),
  started_at     timestamptz not null default now(),
  deadline_at    timestamptz not null,
  submitted_at   timestamptz,
  auto_submitted boolean not null default false,
  graded_by      uuid references public.profiles (user_id) on delete restrict,
  graded_at      timestamptz,
  max_points     numeric(5, 2) not null default 0,
  total_points   numeric(5, 2),
  check (status = 'in_progress' or submitted_at is not null),
  check (status <> 'graded' or (graded_by is not null and graded_at is not null and total_points is not null))
);
create unique index mock_exams_one_open_idx on public.mock_exams (person_id, subject_id) where status = 'in_progress';
create index mock_exams_person_idx on public.mock_exams (person_id, started_at desc);
create index mock_exams_subject_idx on public.mock_exams (subject_id, status, submitted_at);
create index mock_exams_blueprint_idx on public.mock_exams (blueprint_id);
create index mock_exams_graded_by_idx on public.mock_exams (graded_by);

create table public.mock_exam_items (
  id                  uuid primary key default gen_random_uuid(),
  mock_exam_id        uuid not null references public.mock_exams (id) on delete restrict,
  subject_id          uuid not null references public.subjects (id) on delete restrict,
  position            integer not null check (position between 1 and 30),
  sequence            integer not null check (sequence between 1 and 60),
  question_version_id uuid not null references public.question_versions (id) on delete restrict,
  item_number         integer,
  format              text not null,
  scoring             text not null check (scoring in ('single', 'matching', 'parts', 'per_item')),
  mode                text not null check (mode in ('choice', 'true_false', 'open')),
  max_points          numeric(4, 2) not null check (max_points > 0),
  allowed_points      numeric(4, 2)[] not null,
  response            text not null default '' check (length(response) <= 4000),
  proposed_points     numeric(4, 2),
  final_points        numeric(4, 2),
  note                text check (length(note) <= 2000),
  graded_by           uuid references public.profiles (user_id) on delete restrict,
  graded_at           timestamptz,
  unique (mock_exam_id, sequence)
);
create index mock_exam_items_exam_idx on public.mock_exam_items (mock_exam_id, sequence);
create index mock_exam_items_question_idx on public.mock_exam_items (question_version_id);
create index mock_exam_items_subject_idx on public.mock_exam_items (subject_id);
create index mock_exam_items_graded_by_idx on public.mock_exam_items (graded_by);

-- A graded mock exam is final: its units and its result never change.
create or replace function private.mock_exam_items_frozen()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'FROZEN' using errcode = '42501';
  end if;
  if (select status from public.mock_exams where id = old.mock_exam_id) = 'graded' then
    raise exception 'FROZEN' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.mock_exam_items_frozen() from public, anon, authenticated;
create trigger mock_exam_items_frozen before update or delete on public.mock_exam_items
  for each row execute function private.mock_exam_items_frozen();

create or replace function private.mock_exams_frozen()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'DELETE' or old.status = 'graded' then
    raise exception 'FROZEN' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.mock_exams_frozen() from public, anon, authenticated;
create trigger mock_exams_frozen before update or delete on public.mock_exams
  for each row execute function private.mock_exams_frozen();

alter table public.mock_exams enable row level security;
alter table public.mock_exam_items enable row level security;
-- The student reads own mock exams (no key and no points before grading: total_points is set only on confirmation);
-- the units (responses, proposals) only after grading. Staff read those of subjects they grade or follow.
create policy mock_exams_select on public.mock_exams for select to authenticated using (
  exists (select 1 from public.persons p where p.id = person_id and p.profile_user_id = (select auth.uid()))
  or private.has_capability('exams.grade', subject_id) or private.has_capability('students.view_progress', subject_id));
create policy mock_exam_items_select on public.mock_exam_items for select to authenticated using (
  exists (select 1 from public.mock_exams e join public.persons p on p.id = e.person_id
          where e.id = mock_exam_id and e.status = 'graded' and p.profile_user_id = (select auth.uid()))
  or private.has_capability('exams.grade', subject_id) or private.has_capability('students.view_progress', subject_id));

-- ---------------------------------------------------------------------------- notifications
create table public.notifications (
  id                uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references public.profiles (user_id) on delete restrict,
  kind              text not null check (kind in ('mock_exam_submitted', 'mock_exam_graded')),
  entity_id         uuid,
  payload           jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  read_at           timestamptz
);
create index notifications_recipient_idx on public.notifications (recipient_user_id, created_at desc);
alter table public.notifications enable row level security;
create policy notifications_select on public.notifications for select to authenticated using (recipient_user_id = (select auth.uid()));

create or replace function public.notifications_mark_read(p_actor uuid, p_ids uuid[])
returns integer
language plpgsql set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_actor is null or not exists (select 1 from public.profiles where user_id = p_actor and account_status = 'active') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_ids is null or cardinality(p_ids) > 200 then
    raise exception 'VALIDATION' using errcode = '22023';
  end if;
  update public.notifications set read_at = now()
  where recipient_user_id = p_actor and id = any (p_ids) and read_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.notifications_mark_read(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.notifications_mark_read(uuid, uuid[]) to service_role;

-- ---------------------------------------------------------------------------- generation
-- Fills every position of the exam's blueprint with trusted catalogue tasks: never the same task twice, a different
-- area per position where the blueprint asks for it, tasks the person has not had in a mock exam first, then random.
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
      select qv.id, qv.area_id into v_pick
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
                where me.person_id = v_exam.person_id and mi.question_version_id = qv.id),
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
      -- "items": one item of the task, chosen once (German grammar tasks have four, Wortschatz questions one).
      v_chosen := case when v_position ->> 'format' = 'items' then 1 + floor(random() * jsonb_array_length(v_question -> 'items'))::bigint else 1 end;

      for v_item in
        select i from jsonb_array_elements(v_question -> 'items') with ordinality as x (i, n)
        where v_position ->> 'format' = 'task'
           or (v_position ->> 'format' <> 'task' and n = v_chosen)
      loop
        v_sequence := v_sequence + 1;
        v_max := case when v_position ->> 'scoring' = 'per_item' then (v_position ->> 'item_points')::numeric else (v_position ->> 'points')::numeric end;
        v_allowed := case v_position ->> 'scoring'
          when 'parts' then array[0, (v_position ->> 'part_points')::numeric, 2 * (v_position ->> 'part_points')::numeric]
          when 'matching' then (select array_agg(distinct value::numeric order by value::numeric)
                                from jsonb_each_text(private.exam_rule(v_exam.subject_id, 'exam.scoring') -> 'matching_points_by_correct_pairs'))
          else array[0, v_max] end;
        insert into public.mock_exam_items (mock_exam_id, subject_id, position, sequence, question_version_id, item_number, format, scoring, mode, max_points, allowed_points)
        values (v_exam.id, v_exam.subject_id, (v_position ->> 'position')::integer, v_sequence, v_pick.id,
                case when v_position ->> 'format' in ('task', 'items') then (v_item ->> 'item')::integer end,
                v_position ->> 'format', v_position ->> 'scoring',
                -- A whole task answered as one unit is checked automatically only when it is a single choice.
                case when v_position ->> 'format' in ('task', 'items') or jsonb_array_length(v_question -> 'items') = 1 then v_item ->> 'mode' else 'open' end,
                v_max, coalesce(v_allowed, array[0, v_max]));
      end loop;
    end loop;
  end loop;
  return (select coalesce(sum(max_points), 0) from public.mock_exam_items where mock_exam_id = v_exam.id);
end;
$$;
revoke all on function private.mock_exam_generate(uuid) from public, anon, authenticated;
grant execute on function private.mock_exam_generate(uuid) to service_role;

-- ---------------------------------------------------------------------------- close (submit)
-- Submits a mock exam with its saved answers and pre-scores the closed units; notifies the subject's teachers.
create or replace function private.mock_exam_close(p_exam_id uuid, p_auto boolean, p_ip inet default null)
returns void
language plpgsql set search_path = ''
as $$
declare
  v_exam public.mock_exams%rowtype;
begin
  select * into v_exam from public.mock_exams where id = p_exam_id for update;
  if v_exam.status <> 'in_progress' then
    return;
  end if;
  update public.mock_exam_items mi set proposed_points = case
      when btrim(mi.response) = '' then 0
      when mi.mode = 'choice' then case when lower(btrim(mi.response)) = private.choice_label(private.effective_key(k.id)) then mi.max_points else 0 end
      when mi.mode = 'true_false' then case when lower(btrim(mi.response)) = lower(btrim(private.effective_key(k.id))) then mi.max_points else 0 end
    end
  from public.mock_exam_items self
  left join public.answer_keys k on k.question_version_id = self.question_version_id and k.item_number is not distinct from self.item_number
  where mi.id = self.id and mi.mock_exam_id = v_exam.id;
  update public.mock_exams set status = 'submitted', submitted_at = case when p_auto then least(now(), deadline_at) else now() end, auto_submitted = p_auto
  where id = v_exam.id;

  insert into public.notifications (recipient_user_id, kind, entity_id, payload)
  select distinct pb.profile_user_id, 'mock_exam_submitted', v_exam.id, jsonb_build_object('subject_id', v_exam.subject_id)
  from public.profile_bundles pb
  join public.bundle_capabilities bc on bc.bundle_code = pb.bundle_code and bc.capability_code = 'exams.grade'
  join public.profiles p on p.user_id = pb.profile_user_id and p.account_status = 'active'
  where pb.scope_subject_id is null or pb.scope_subject_id = v_exam.subject_id;
  -- No teacher of the subject yet: the superadministrators are told, so no submission waits unseen.
  if not found then
    insert into public.notifications (recipient_user_id, kind, entity_id, payload)
    select p.user_id, 'mock_exam_submitted', v_exam.id, jsonb_build_object('subject_id', v_exam.subject_id)
    from public.profiles p
    join public.role_capabilities rc on rc.role = p.role and rc.capability_code = 'exams.grade'
    where p.account_status = 'active';
  end if;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address)
  values ((select profile_user_id from public.persons where id = v_exam.person_id), 'exam.submitted', 'mock_exams', v_exam.id::text,
          jsonb_build_object('automatic', p_auto), p_ip);
end;
$$;
revoke all on function private.mock_exam_close(uuid, boolean, inet) from public, anon, authenticated;
grant execute on function private.mock_exam_close(uuid, boolean, inet) to service_role;

-- ---------------------------------------------------------------------------- payload
-- The mock exam as its reader may see it. p_staff: responses, proposals, points, notes and solutions. Student: the
-- questions (no keys) and own responses; points, notes and solutions only once the teacher has confirmed.
create or replace function private.mock_exam_payload(p_exam_id uuid, p_staff boolean)
returns jsonb
language plpgsql stable set search_path = ''
as $$
declare
  v_exam     public.mock_exams%rowtype;
  v_released boolean;
begin
  select * into v_exam from public.mock_exams where id = p_exam_id;
  v_released := p_staff or v_exam.status = 'graded';
  return jsonb_build_object(
    'id', v_exam.id,
    'subject_id', v_exam.subject_id,
    'subject_code', (select code from public.subjects where id = v_exam.subject_id),
    'student', case when p_staff then (select pr.display_name from public.persons pe join public.profiles pr on pr.user_id = pe.profile_user_id where pe.id = v_exam.person_id) end,
    'status', v_exam.status,
    'started_at', v_exam.started_at,
    'deadline_at', v_exam.deadline_at,
    'submitted_at', v_exam.submitted_at,
    'auto_submitted', v_exam.auto_submitted,
    'graded_at', v_exam.graded_at,
    'max_points', v_exam.max_points,
    'total_points', case when v_released then v_exam.total_points end,
    'server_now', now(),
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', mi.id, 'position', mi.position, 'sequence', mi.sequence, 'question_version_id', mi.question_version_id,
               'item', mi.item_number, 'format', mi.format, 'scoring', mi.scoring, 'mode', mi.mode, 'max_points', mi.max_points,
               'allowed_points', to_jsonb(mi.allowed_points), 'response', mi.response,
               'proposed_points', case when p_staff then mi.proposed_points end,
               'final_points', case when v_released then mi.final_points end,
               'note', case when v_released then mi.note end,
               'solution', case when v_released then private.effective_key(k.id) end)
             order by mi.sequence), '[]'::jsonb)
      from public.mock_exam_items mi
      left join public.answer_keys k on k.question_version_id = mi.question_version_id and k.item_number is not distinct from mi.item_number
      where mi.mock_exam_id = v_exam.id),
    'questions', (
      select coalesce(jsonb_object_agg(q.id, private.practice_question(q.id)), '{}'::jsonb)
      from (select distinct question_version_id as id from public.mock_exam_items where mock_exam_id = v_exam.id) q));
end;
$$;
revoke all on function private.mock_exam_payload(uuid, boolean) from public, anon, authenticated;
grant execute on function private.mock_exam_payload(uuid, boolean) to service_role;

-- ---------------------------------------------------------------------------- student functions
-- Starts a mock exam of the subject, or returns the one in progress (an expired one is submitted first).
create or replace function public.mock_exam_start(p_actor uuid, p_subject_id uuid, p_ip inet)
returns uuid
language plpgsql set search_path = ''
as $$
declare
  v_person    uuid;
  v_blueprint public.exam_blueprints%rowtype;
  v_open      public.mock_exams%rowtype;
  v_minutes   integer;
  v_id        uuid;
  v_max       numeric;
begin
  v_person := private.practice_person(p_actor);
  if p_subject_id is null or not exists (select 1 from public.subjects where id = p_subject_id) then
    raise exception 'VALIDATION' using errcode = '22023';
  end if;
  select * into v_open from public.mock_exams where person_id = v_person and subject_id = p_subject_id and status = 'in_progress' for update;
  if found then
    if v_open.deadline_at > now() then
      return v_open.id;
    end if;
    perform private.mock_exam_close(v_open.id, true);
  end if;
  v_blueprint := private.exam_blueprint(p_subject_id);
  if v_blueprint.id is null then
    raise exception 'NO_BLUEPRINT' using errcode = 'P0002';
  end if;
  v_minutes := (private.exam_rule(p_subject_id, 'exam.duration_minutes') ->> 'minutes')::integer;
  if v_minutes is null or v_minutes not between 1 and 300 then
    raise exception 'NO_RULE' using errcode = 'P0002';
  end if;
  insert into public.mock_exams (person_id, subject_id, blueprint_id, deadline_at)
  values (v_person, p_subject_id, v_blueprint.id, now() + make_interval(mins => v_minutes)) returning id into v_id;
  v_max := private.mock_exam_generate(v_id);
  update public.mock_exams set max_points = v_max where id = v_id;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address)
  values (p_actor, 'exam.started', 'mock_exams', v_id::text, jsonb_build_object('subject_id', p_subject_id, 'blueprint', v_blueprint.version), p_ip);
  return v_id;
end;
$$;
revoke all on function public.mock_exam_start(uuid, uuid, inet) from public, anon, authenticated;
grant execute on function public.mock_exam_start(uuid, uuid, inet) to service_role;

-- The student's own mock exam; an exam past its deadline is submitted first.
create or replace function public.mock_exam_view(p_actor uuid, p_exam_id uuid)
returns jsonb
language plpgsql set search_path = ''
as $$
declare
  v_person uuid;
  v_exam   public.mock_exams%rowtype;
begin
  v_person := private.practice_person(p_actor);
  select * into v_exam from public.mock_exams where id = p_exam_id and person_id = v_person;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_exam.status = 'in_progress' and v_exam.deadline_at <= now() then
    perform private.mock_exam_close(v_exam.id, true);
  end if;
  return private.mock_exam_payload(v_exam.id, false);
end;
$$;
revoke all on function public.mock_exam_view(uuid, uuid) from public, anon, authenticated;
grant execute on function public.mock_exam_view(uuid, uuid) to service_role;

-- Saves answers while writing: p_responses [{id, response}]. Accepted until the deadline plus 30 seconds of network
-- grace; later answers are ignored and the callers submit the exam with what was saved.
create or replace function private.mock_exam_store(p_person uuid, p_exam_id uuid, p_responses jsonb)
returns public.mock_exams
language plpgsql set search_path = ''
as $$
declare
  v_exam public.mock_exams%rowtype;
begin
  select * into v_exam from public.mock_exams where id = p_exam_id and person_id = p_person for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_exam.status <> 'in_progress' then
    raise exception 'CLOSED' using errcode = '22023';
  end if;
  if p_responses is null or jsonb_typeof(p_responses) <> 'array' or jsonb_array_length(p_responses) > 60
     or exists (select 1 from jsonb_array_elements(p_responses) r
                where jsonb_typeof(r -> 'response') is distinct from 'string' or length(r ->> 'response') > 4000
                   or jsonb_typeof(r -> 'id') is distinct from 'string'
                   or not exists (select 1 from public.mock_exam_items mi where mi.mock_exam_id = v_exam.id and mi.id::text = r ->> 'id'))
  then
    raise exception 'VALIDATION' using errcode = '22023';
  end if;
  if now() > v_exam.deadline_at + interval '30 seconds' then
    return v_exam;
  end if;
  update public.mock_exam_items mi set response = r ->> 'response'
  from jsonb_array_elements(p_responses) r
  where mi.mock_exam_id = v_exam.id and mi.id::text = r ->> 'id';
  return v_exam;
end;
$$;
revoke all on function private.mock_exam_store(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function private.mock_exam_store(uuid, uuid, jsonb) to service_role;

create or replace function public.mock_exam_save(p_actor uuid, p_exam_id uuid, p_responses jsonb)
returns jsonb
language plpgsql set search_path = ''
as $$
declare
  v_exam public.mock_exams%rowtype;
begin
  v_exam := private.mock_exam_store(private.practice_person(p_actor), p_exam_id, p_responses);
  if now() > v_exam.deadline_at + interval '30 seconds' then
    perform private.mock_exam_close(v_exam.id, true);
    return jsonb_build_object('status', 'submitted', 'saved', false);
  end if;
  return jsonb_build_object('status', 'in_progress', 'saved', true, 'server_now', now(), 'deadline_at', v_exam.deadline_at);
end;
$$;
revoke all on function public.mock_exam_save(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.mock_exam_save(uuid, uuid, jsonb) to service_role;

create or replace function public.mock_exam_submit(p_actor uuid, p_exam_id uuid, p_responses jsonb, p_ip inet)
returns jsonb
language plpgsql set search_path = ''
as $$
declare
  v_exam public.mock_exams%rowtype;
  v_late boolean;
begin
  v_exam := private.mock_exam_store(private.practice_person(p_actor), p_exam_id, p_responses);
  v_late := now() > v_exam.deadline_at + interval '30 seconds';
  perform private.mock_exam_close(v_exam.id, v_late, p_ip);
  return jsonb_build_object('status', 'submitted', 'late', v_late);
end;
$$;
revoke all on function public.mock_exam_submit(uuid, uuid, jsonb, inet) from public, anon, authenticated;
grant execute on function public.mock_exam_submit(uuid, uuid, jsonb, inet) to service_role;

-- Per subject: whether a confirmed blueprint exists, the exam in progress, and the student's mock exams.
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
               'open_exam_id', (select e.id from public.mock_exams e where e.person_id = v_person and e.subject_id = s.id and e.status = 'in_progress'))
             order by s.code), '[]'::jsonb)
      from public.subjects s),
    'exams', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', e.id, 'subject_code', s.code, 'status', e.status, 'started_at', e.started_at, 'submitted_at', e.submitted_at,
               'graded_at', e.graded_at, 'max_points', e.max_points, 'total_points', case when e.status = 'graded' then e.total_points end)
             order by e.started_at desc), '[]'::jsonb)
      from (select * from public.mock_exams where person_id = v_person order by started_at desc limit 50) e
      join public.subjects s on s.id = e.subject_id));
end;
$$;
revoke all on function public.mock_exam_overview(uuid) from public, anon, authenticated;
grant execute on function public.mock_exam_overview(uuid) to service_role;

-- ---------------------------------------------------------------------------- grading
-- Submitted and recently graded mock exams of the subjects the actor grades (expired ones are submitted first).
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
             'submitted_at', e.submitted_at, 'auto_submitted', e.auto_submitted, 'graded_at', e.graded_at,
             'max_points', e.max_points, 'total_points', e.total_points,
             'units', (select count(*) from public.mock_exam_items mi where mi.mock_exam_id = e.id),
             'ungraded', (select count(*) from public.mock_exam_items mi where mi.mock_exam_id = e.id and coalesce(mi.final_points, mi.proposed_points) is null))
           order by (e.status = 'graded'), e.submitted_at), '[]'::jsonb)
    from public.mock_exams e
    join public.subjects s on s.id = e.subject_id
    join public.persons pe on pe.id = e.person_id
    join public.profiles pr on pr.user_id = pe.profile_user_id
    where (e.status = 'submitted' or (e.status = 'graded' and e.graded_at > now() - interval '30 days'))
      and private.actor_has_subject_capability(p_actor, 'exams.grade', e.subject_id));
end;
$$;
revoke all on function public.grading_queue(uuid) from public, anon, authenticated;
grant execute on function public.grading_queue(uuid) to service_role;

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
revoke all on function public.grading_view(uuid, uuid) from public, anon, authenticated;
grant execute on function public.grading_view(uuid, uuid) to service_role;

-- p_scores: [{id, points (a value the unit allows, or null to clear), note}]. Only while the exam is submitted.
create or replace function public.grading_save(p_actor uuid, p_exam_id uuid, p_scores jsonb, p_ip inet)
returns integer
language plpgsql set search_path = ''
as $$
declare
  v_exam  public.mock_exams%rowtype;
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
  if p_scores is null or jsonb_typeof(p_scores) <> 'array' or jsonb_array_length(p_scores) not between 1 and 60
     or exists (
       select 1 from jsonb_array_elements(p_scores) s
       left join public.mock_exam_items mi on mi.mock_exam_id = v_exam.id and mi.id::text = s ->> 'id'
       where mi.id is null
          or (jsonb_typeof(s -> 'points') is distinct from 'null' and jsonb_typeof(s -> 'points') is distinct from 'number')
          or (jsonb_typeof(s -> 'points') = 'number' and not ((s ->> 'points')::numeric = any (mi.allowed_points)))
          or (s ? 'note' and jsonb_typeof(s -> 'note') not in ('string', 'null'))
          or length(coalesce(s ->> 'note', '')) > 2000)
  then
    raise exception 'VALIDATION' using errcode = '22023';
  end if;
  update public.mock_exam_items mi
  set final_points = (s ->> 'points')::numeric,
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
revoke all on function public.grading_save(uuid, uuid, jsonb, inet) from public, anon, authenticated;
grant execute on function public.grading_save(uuid, uuid, jsonb, inet) to service_role;

-- Confirms the result: every unit has the teacher's points or an accepted proposal; the student is notified.
create or replace function public.grading_confirm(p_actor uuid, p_exam_id uuid, p_ip inet)
returns numeric
language plpgsql set search_path = ''
as $$
declare
  v_exam  public.mock_exams%rowtype;
  v_total numeric;
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
  if exists (select 1 from public.mock_exam_items where mock_exam_id = v_exam.id and coalesce(final_points, proposed_points) is null) then
    raise exception 'UNGRADED' using errcode = '22023';
  end if;
  update public.mock_exam_items
  set final_points = proposed_points, graded_by = p_actor, graded_at = now()
  where mock_exam_id = v_exam.id and final_points is null;
  select sum(final_points) into v_total from public.mock_exam_items where mock_exam_id = v_exam.id;
  update public.mock_exams set status = 'graded', graded_by = p_actor, graded_at = now(), total_points = v_total where id = v_exam.id;
  insert into public.notifications (recipient_user_id, kind, entity_id, payload)
  select pe.profile_user_id, 'mock_exam_graded', v_exam.id, jsonb_build_object('subject_id', v_exam.subject_id)
  from public.persons pe where pe.id = v_exam.person_id and pe.profile_user_id is not null;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address)
  values (p_actor, 'exam.result_confirmed', 'mock_exams', v_exam.id::text, jsonb_build_object('total', v_total, 'max', v_exam.max_points), p_ip);
  return v_total;
end;
$$;
revoke all on function public.grading_confirm(uuid, uuid, inet) from public, anon, authenticated;
grant execute on function public.grading_confirm(uuid, uuid, inet) to service_role;
