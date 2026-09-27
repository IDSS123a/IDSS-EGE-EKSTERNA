-- Migration: 004_private_auth_helpers
-- Date: 2026-09-27
-- Author: ACA (Claude Code)
-- Description: Move the SECURITY DEFINER authorization helpers out of the API-exposed `public`
--              schema into `private`, and pin the trigger function's search_path.
--              Why: Supabase grants EXECUTE on new public functions to `anon` and `authenticated`
--              by default, which exposed has_capability()/current_account_role() as
--              /rest/v1/rpc endpoints (Supabase security advisor lints 0011, 0028, 0029,
--              found right after applying 001–003). RLS policies reference functions by OID,
--              so existing policies keep working after the schema move.
-- Rollback:
--   alter function private.has_capability(text, uuid) set schema public;
--   alter function private.current_account_role() set schema public;
--   drop schema private;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

alter function public.has_capability(text, uuid) set schema private;
alter function public.current_account_role() set schema private;

revoke all on function private.has_capability(text, uuid) from public, anon;
revoke all on function private.current_account_role() from public, anon;
grant execute on function private.has_capability(text, uuid) to authenticated, service_role;
grant execute on function private.current_account_role() to authenticated, service_role;

alter function public.reject_audit_mutation() set search_path = '';
revoke all on function public.reject_audit_mutation() from public, anon, authenticated;
