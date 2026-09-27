-- Migration: 003_audit
-- Date: 2026-09-27
-- Author: ACA (Claude Code)
-- Description: Append-only audit log and security events (mandate §7A.5, §7A.7; E-5).
--              Rows can be inserted by the server only; UPDATE and DELETE are rejected for
--              every role, including the service role, by trigger.
-- Rollback:
--   drop table if exists public.security_events, public.audit_logs cascade;
--   drop function if exists public.reject_audit_mutation();

create table public.audit_logs (
  id            bigint generated always as identity primary key,
  occurred_at   timestamptz not null default now(),
  actor_user_id uuid references public.profiles (user_id) on delete no action,
  action        text not null check (action ~ '^[a-z_]+\.[a-z_]+$'),
  entity_type   text not null,
  entity_id     text,
  -- Hashes and minimal structured facts only — never passwords, tokens or support-note content (E-8, M-15).
  details       jsonb not null default '{}'::jsonb,
  ip_address    inet
);
create index audit_logs_occurred_at_idx on public.audit_logs (occurred_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_user_id, occurred_at desc);

create table public.security_events (
  id               bigint generated always as identity primary key,
  occurred_at      timestamptz not null default now(),
  kind             text not null check (kind in ('login_failed', 'login_locked', 'permission_denied', 'rate_limited', 'token_rejected')),
  -- Username attempts are stored as a SHA-256 hash to avoid building a list of guessed names.
  username_sha256  text check (username_sha256 ~ '^[0-9a-f]{64}$'),
  user_id          uuid references public.profiles (user_id) on delete no action,
  ip_address       inet,
  details          jsonb not null default '{}'::jsonb
);
create index security_events_lookup_idx on public.security_events (kind, username_sha256, occurred_at desc);

create or replace function public.reject_audit_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'audit records are append-only (% on %)', tg_op, tg_table_name;
end;
$$;

create trigger audit_logs_append_only before update or delete on public.audit_logs
  for each row execute function public.reject_audit_mutation();
create trigger security_events_append_only before update or delete on public.security_events
  for each row execute function public.reject_audit_mutation();

alter table public.audit_logs      enable row level security;
alter table public.security_events enable row level security;

create policy audit_logs_select on public.audit_logs
  for select to authenticated using (public.has_capability('audit.view'));
create policy security_events_select on public.security_events
  for select to authenticated using (public.has_capability('audit.view'));
