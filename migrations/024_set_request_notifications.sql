-- Migration: 024_set_request_notifications
-- Date: 2026-10-03
-- Author: ACA (Claude Code)
-- Description: Sprint 08 item 3. A student's request for a mock exam set notifies the teachers of the subject (the
--   superadministrators when the subject has no teacher), so no set waits for approval unseen. New notification kind
--   'mock_exam_requested'; private.notify_graders shares the recipient rule with the submission notice.
--   Contains DROP CONSTRAINT: run by the Director in the Supabase SQL editor (lesson Sprint 07), then record history.
-- Rollback:
--   re-apply public.mock_exam_start (022) and private.mock_exam_close (019);
--   drop function if exists private.notify_graders(uuid, uuid, text);
--   delete from public.notifications where kind = 'mock_exam_requested';
--   alter table public.notifications drop constraint notifications_kind_check;
--   alter table public.notifications add constraint notifications_kind_check check (kind in ('mock_exam_submitted', 'mock_exam_graded'));

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('mock_exam_requested', 'mock_exam_submitted', 'mock_exam_graded'));

-- Teachers of the subject (bundles with exams.grade scoped to it or to all subjects); the superadministrators when none.
create or replace function private.notify_graders(p_exam_id uuid, p_subject_id uuid, p_kind text)
returns void
language plpgsql set search_path = ''
as $$
begin
  insert into public.notifications (recipient_user_id, kind, entity_id, payload)
  select distinct pb.profile_user_id, p_kind, p_exam_id, jsonb_build_object('subject_id', p_subject_id)
  from public.profile_bundles pb
  join public.bundle_capabilities bc on bc.bundle_code = pb.bundle_code and bc.capability_code = 'exams.grade'
  join public.profiles p on p.user_id = pb.profile_user_id and p.account_status = 'active'
  where pb.scope_subject_id is null or pb.scope_subject_id = p_subject_id;
  if not found then
    insert into public.notifications (recipient_user_id, kind, entity_id, payload)
    select p.user_id, p_kind, p_exam_id, jsonb_build_object('subject_id', p_subject_id)
    from public.profiles p
    join public.role_capabilities rc on rc.role = p.role and rc.capability_code = 'exams.grade'
    where p.account_status = 'active';
  end if;
end;
$$;
revoke all on function private.notify_graders(uuid, uuid, text) from public, anon, authenticated;
grant execute on function private.notify_graders(uuid, uuid, text) to service_role;

-- 019 body with the recipient rule moved to private.notify_graders (behaviour unchanged).
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
  perform private.notify_graders(v_exam.id, v_exam.subject_id, 'mock_exam_submitted');
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address)
  values ((select profile_user_id from public.persons where id = v_exam.person_id), 'exam.submitted', 'mock_exams', v_exam.id::text,
          jsonb_build_object('automatic', p_auto), p_ip);
end;
$$;
revoke all on function private.mock_exam_close(uuid, boolean, inet) from public, anon, authenticated;
grant execute on function private.mock_exam_close(uuid, boolean, inet) to service_role;

-- 022 body; a new set notifies the teachers of the subject.
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
  perform private.notify_graders(v_id, p_subject_id, 'mock_exam_requested');
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address)
  values (p_actor, 'exam.requested', 'mock_exams', v_id::text, jsonb_build_object('subject_id', p_subject_id), p_ip);
  return v_id;
end;
$$;
revoke all on function public.mock_exam_start(uuid, uuid, inet) from public, anon, authenticated;
grant execute on function public.mock_exam_start(uuid, uuid, inet) to service_role;
