-- Migration: 034_director_system_migrations
-- Date: 2026-10-04
-- Author: ACA (Claude Code)
-- Description: Sprint 10 fix (PDL-040). public.director_system read supabase_migrations.schema_migrations directly;
--   it runs as service_role, which has no usage on that schema on Supabase, so the Sistem tab failed with 42501
--   (seen live by the Director). The list of the latest migrations now comes from private.recent_migrations, a
--   security definer function owned by postgres that returns only version and name. director_system is otherwise
--   unchanged.
-- Rollback: re-run the director_system definition of migration 033; revoke and remove private.recent_migrations.

create or replace function private.recent_migrations(p_limit integer)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_rows jsonb := '[]'::jsonb;
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    execute 'select coalesce(jsonb_agg(jsonb_build_object(''version'', version, ''name'', name) order by version desc), ''[]''::jsonb)
             from (select version, name from supabase_migrations.schema_migrations order by version desc limit $1) m'
      into v_rows using least(greatest(coalesce(p_limit, 8), 1), 20);
  end if;
  return v_rows;
end;
$$;
revoke all on function private.recent_migrations(integer) from public, anon, authenticated;
grant execute on function private.recent_migrations(integer) to service_role;

create or replace function public.director_system(p_actor uuid)
returns jsonb
language plpgsql stable set search_path = ''
as $$
begin
  perform private.director_check(p_actor, now());
  return jsonb_build_object(
    'jobs', (select coalesce(jsonb_agg(jsonb_build_object('state', j.state, 'profile', j.profile_code, 'finished_at', j.finished_at, 'pages', j.page_count) order by j.started_at desc), '[]'::jsonb)
             from (select * from public.canonical_ingestion_jobs order by started_at desc limit 5) j),
    'security', (select coalesce(jsonb_object_agg(k.kind, k.n), '{}'::jsonb)
                 from (select kind, count(*) as n from public.security_events where occurred_at > now() - interval '30 days' group by 1) k),
    'chunks', (select count(*) from public.canonical_chunks),
    'embeddings', (select count(*) from public.canonical_chunk_embeddings),
    'index_built_at', (select max(built_at) from public.canonical_chunks),
    'notification_kinds', (select pg_get_constraintdef(c.oid) from pg_constraint c where c.conrelid = 'public.notifications'::regclass and c.conname = 'notifications_kind_check'),
    'migrations', private.recent_migrations(8));
end;
$$;
revoke all on function public.director_system(uuid) from public, anon, authenticated;
grant execute on function public.director_system(uuid) to service_role;
