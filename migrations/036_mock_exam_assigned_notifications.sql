-- Migration: 036_mock_exam_assigned_notifications
-- Date: 2026-10-04
-- Author: ACA (Claude Code)
-- Description: PDL-043. New notification kind 'mock_exam_assigned': the student gets an in-app notice when the
--   teacher approves a test or a part of a test the teacher sent (migration 035 already calls the notice and skips it
--   quietly until this constraint allows the kind).
--   Contains DROP CONSTRAINT: run by the Director in the Supabase SQL editor, then the ACA records the history.
-- Rollback:
--   delete from public.notifications where kind = 'mock_exam_assigned';
--   alter table public.notifications drop constraint notifications_kind_check;
--   alter table public.notifications add constraint notifications_kind_check
--     check (kind in ('mock_exam_requested', 'mock_exam_submitted', 'mock_exam_graded', 'assignment_given', 'gift_given'));

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('mock_exam_requested', 'mock_exam_submitted', 'mock_exam_graded', 'assignment_given', 'gift_given', 'mock_exam_assigned'));
