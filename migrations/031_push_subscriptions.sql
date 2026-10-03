-- Migration: 031_push_subscriptions
-- Date: 2026-10-03
-- Author: ACA (Claude Code)
-- Description: Sprint 09 (PDL-035 Z6, PDL-037). Web Push: a browser the user allowed stores its push subscription
--   (endpoint and the two public encryption values from the browser; no password, no message content). The server
--   sends a short notice through the browser's push service (end-to-end encrypted, no provider account, no cost).
--   A subscription belongs to one account; the account removes it, and the server removes it when the push service
--   reports it gone. Service-role functions only.
-- Rollback:
--   drop function if exists public.push_subscribe(uuid, text, text, text, text), public.push_unsubscribe(uuid, text),
--     public.push_forget(text), public.push_targets_of_assignment(uuid), public.push_has_subscription(uuid);
--   drop table if exists public.push_subscriptions;

create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (user_id) on delete cascade,
  endpoint   text not null unique check (endpoint ~ '^https://' and length(endpoint) <= 1000),
  p256dh     text not null check (length(p256dh) between 20 and 200),
  auth       text not null check (length(auth) between 8 and 100),
  user_agent text check (user_agent is null or length(user_agent) <= 300),
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
create policy push_subscriptions_select on public.push_subscriptions for select to authenticated using (user_id = (select auth.uid()));

-- Store (or move to this account) the subscription of the browser in use.
create or replace function public.push_subscribe(p_actor uuid, p_endpoint text, p_p256dh text, p_auth text, p_user_agent text)
returns void
language plpgsql set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles where user_id = p_actor and account_status = 'active') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_endpoint is null or p_endpoint !~ '^https://' or length(p_endpoint) > 1000
     or length(coalesce(p_p256dh, '')) not between 20 and 200 or length(coalesce(p_auth, '')) not between 8 and 100 then
    raise exception 'VALIDATION' using errcode = '22023';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (p_actor, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
    user_agent = excluded.user_agent, created_at = now();
end;
$$;
revoke all on function public.push_subscribe(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.push_subscribe(uuid, text, text, text, text) to service_role;

-- The account turns push off for this browser.
create or replace function public.push_unsubscribe(p_actor uuid, p_endpoint text)
returns void
language sql set search_path = ''
as $$
  delete from public.push_subscriptions where user_id = p_actor and endpoint = p_endpoint;
$$;
revoke all on function public.push_unsubscribe(uuid, text) from public, anon, authenticated;
grant execute on function public.push_unsubscribe(uuid, text) to service_role;

-- The push service answered 404 or 410: the browser no longer has this subscription.
create or replace function public.push_forget(p_endpoint text)
returns void
language sql set search_path = ''
as $$
  delete from public.push_subscriptions where endpoint = p_endpoint;
$$;
revoke all on function public.push_forget(text) from public, anon, authenticated;
grant execute on function public.push_forget(text) to service_role;

-- Whether the account has at least one subscribed browser (shown beside the switch).
create or replace function public.push_has_subscription(p_actor uuid)
returns boolean
language sql stable set search_path = ''
as $$
  select exists (select 1 from public.push_subscriptions where user_id = p_actor);
$$;
revoke all on function public.push_has_subscription(uuid) from public, anon, authenticated;
grant execute on function public.push_has_subscription(uuid) to service_role;

-- Subscriptions of the active recipients of an assignment, with the assignment's title for the notice.
create or replace function public.push_targets_of_assignment(p_assignment uuid)
returns jsonb
language sql stable set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('endpoint', ps.endpoint, 'p256dh', ps.p256dh, 'auth', ps.auth, 'title', a.title, 'subject', s.code)), '[]'::jsonb)
  from public.assignments a
  join public.subjects s on s.id = a.subject_id
  join public.assignment_recipients r on r.assignment_id = a.id
  join public.persons pe on pe.id = r.person_id
  join public.profiles p on p.user_id = pe.profile_user_id and p.account_status = 'active'
  join public.push_subscriptions ps on ps.user_id = p.user_id
  where a.id = p_assignment;
$$;
revoke all on function public.push_targets_of_assignment(uuid) from public, anon, authenticated;
grant execute on function public.push_targets_of_assignment(uuid) to service_role;
