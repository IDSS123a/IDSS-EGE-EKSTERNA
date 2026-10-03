-- Migration: 030_assignment_notifications
-- Date: 2026-10-03
-- Author: ACA (Claude Code)
-- Description: Sprint 09 (PDL-035 Z6). New notification kind 'assignment_given': every recipient of a new assignment
--   gets an in-app notification (the app also sends Web Push where the student allowed it). Replaces the no-op
--   private.assignment_notify of migration 029.
--   Contains DROP CONSTRAINT: run by the Director in the Supabase SQL editor (lesson Sprint 07), then record history.
-- Rollback:
--   create or replace function private.assignment_notify(p_assignment uuid) returns void language sql set search_path = '' as $f$ select $f$;
--   delete from public.notifications where kind = 'assignment_given';
--   alter table public.notifications drop constraint notifications_kind_check;
--   alter table public.notifications add constraint notifications_kind_check
--     check (kind in ('mock_exam_requested', 'mock_exam_submitted', 'mock_exam_graded'));

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('mock_exam_requested', 'mock_exam_submitted', 'mock_exam_graded', 'assignment_given'));

create or replace function private.assignment_notify(p_assignment uuid)
returns void
language sql set search_path = ''
as $$
  insert into public.notifications (recipient_user_id, kind, entity_id, payload)
  select pe.profile_user_id, 'assignment_given', a.id, jsonb_build_object('subject_id', a.subject_id)
  from public.assignments a
  join public.assignment_recipients r on r.assignment_id = a.id
  join public.persons pe on pe.id = r.person_id
  join public.profiles p on p.user_id = pe.profile_user_id and p.account_status = 'active'
  where a.id = p_assignment;
$$;
revoke all on function private.assignment_notify(uuid) from public, anon, authenticated;
grant execute on function private.assignment_notify(uuid) to service_role;
