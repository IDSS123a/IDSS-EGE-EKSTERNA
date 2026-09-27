-- Migration: 012_system_settings
-- Date: 2026-09-27
-- Author: ACA (Claude Code)
-- Description: Settings the Superadmin changes in the app (DATA_MODEL §8 system_settings; PDL-020). First setting:
--   the splash palette, the share of each IDSS colour in percent (Director: red only in traces, set by him).
--   * capability settings.manage (Superadmin role).
--   * system_settings: key, value, who and when; readable only with settings.manage (the public splash reads its one
--     key through a server route with the service role).
--   * set_splash_palette(): SECURITY INVOKER, service_role only; re-checks the actor, validates four shares that add up
--     to 100, writes the setting and the audit row (before and after) in one transaction.
-- Rollback:
--   drop function if exists public.set_splash_palette(uuid, jsonb, inet);
--   drop table if exists public.system_settings;
--   delete from public.role_capabilities where capability_code = 'settings.manage';
--   delete from public.capabilities where code = 'settings.manage';

insert into public.capabilities (code, description) values
  ('settings.manage', 'Change application settings (e.g. the splash palette)');
insert into public.role_capabilities (role, capability_code) values ('superadmin', 'settings.manage');

create table public.system_settings (
  key        text primary key check (key ~ '^[a-z_]+\.[a-z_]+$'),
  value      jsonb not null,
  updated_by uuid references public.profiles (user_id) on delete restrict,
  updated_at timestamptz not null default now()
);
create index system_settings_updated_by_idx on public.system_settings (updated_by);

alter table public.system_settings enable row level security;
create policy system_settings_select on public.system_settings for select to authenticated using (private.has_capability('settings.manage'));

-- Default: yellow, blue and sky prevail, red only in traces (PDL-019).
insert into public.system_settings (key, value) values
  ('splash.palette', '{"red": 2, "yellow": 36, "blue": 29, "sky": 33}');

create or replace function public.set_splash_palette(p_actor uuid, p_value jsonb, p_ip inet)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_before jsonb;
  v_value  jsonb;
begin
  if not private.actor_has_capability(p_actor, 'settings.manage') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if jsonb_typeof(p_value) <> 'object'
     or (select count(*) from jsonb_object_keys(p_value)) <> 4
     or not (p_value ?& array['red', 'yellow', 'blue', 'sky'])
     or exists (select 1 from jsonb_each(p_value) e where jsonb_typeof(e.value) <> 'number' or (e.value)::numeric not between 0 and 100)
     or abs((select sum((e.value)::numeric) from jsonb_each(p_value) e) - 100) >= 0.1 then
    raise exception 'VALIDATION' using errcode = '22023';
  end if;
  v_value := jsonb_build_object('red', p_value -> 'red', 'yellow', p_value -> 'yellow', 'blue', p_value -> 'blue', 'sky', p_value -> 'sky');
  select value into v_before from public.system_settings where key = 'splash.palette';
  insert into public.system_settings (key, value, updated_by, updated_at) values ('splash.palette', v_value, p_actor, now())
  on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address)
  values (p_actor, 'settings.splash_palette_changed', 'system_setting', 'splash.palette',
          jsonb_build_object('before', v_before, 'after', v_value), p_ip);
  return v_value;
end;
$$;
revoke all on function public.set_splash_palette(uuid, jsonb, inet) from public, anon, authenticated;
grant execute on function public.set_splash_palette(uuid, jsonb, inet) to service_role;
