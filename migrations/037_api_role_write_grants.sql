-- Migration: 037_api_role_write_grants
-- Date: 2026-10-18
-- Author: ACA (Claude Code)
-- Description: Forensic audit 2026-10-18, finding DB-1 (defence in depth). Supabase grants INSERT, UPDATE, DELETE and
--   TRUNCATE on every public table to the API roles anon and authenticated. RLS already refuses every write (there is
--   no write policy; all writes go through service-role functions), but TRUNCATE ignores RLS and row triggers.
--   1. The API roles keep SELECT only (RLS decides which rows); the same for tables created later.
--   2. Every append-only or frozen table also refuses TRUNCATE (statement trigger), so history cannot be emptied even
--      by a role that may truncate. The clean start (PDL-038) lifts these guards together with the row guards.
--   No data changes. Run by the Director in the Supabase SQL editor, then the ACA records the history and runs the
--   security advisor.
-- Rollback:
--   grant insert, update, delete, truncate on all tables in schema public to anon, authenticated;
--   alter default privileges for role postgres in schema public grant insert, update, delete, truncate on tables to anon, authenticated;
--   drop trigger if exists <table>_no_truncate on public.<table>;  (for each table in the list below)

revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;
alter default privileges for role postgres in schema public revoke insert, update, delete, truncate on tables from anon, authenticated;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'answer_key_revisions', 'answer_keys', 'assignment_questions', 'assignment_recipients', 'assignment_withdrawals',
    'assignments', 'audit_logs', 'canon_follow_up_resolutions', 'canon_follow_ups', 'canonical_chunk_embeddings',
    'canonical_chunks', 'canonical_ingestion_jobs', 'canonical_rule_reviews', 'canonical_rules',
    'canonical_version_events', 'catalogue_errata', 'exam_blueprint_reviews', 'exam_blueprints', 'gift_openings',
    'gifts', 'ingested_records', 'mock_exam_items', 'mock_exam_sends', 'mock_exams', 'practice_answer_reviews',
    'practice_answers', 'question_text_revisions', 'question_versions', 'questions', 'record_reviews',
    'retrieval_audit_logs', 'security_events', 'support_notes', 'teacher_notes'
  ] loop
    execute format('drop trigger if exists %I on public.%I', v_table || '_no_truncate', v_table);
    execute format('create trigger %I before truncate on public.%I for each statement execute function public.reject_audit_mutation()',
      v_table || '_no_truncate', v_table);
  end loop;
end;
$$;
