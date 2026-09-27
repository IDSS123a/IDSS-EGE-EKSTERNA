-- Minimal stand-in for the parts of Supabase that migrations rely on, so RLS can be tested
-- on plain PostgreSQL. Mirrors Supabase: roles anon/authenticated/service_role (bypassrls),
-- auth.users, and auth.uid() reading the verified JWT claims set by PostgREST.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(current_setting('request.jwt.claim.sub', true),
                         (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')), '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
-- Supabase grants table privileges on public to these roles by default; RLS then decides rows.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
-- Like Supabase: new functions in public are executable by anon and authenticated by default.
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
-- Supabase Storage: only the bucket catalogue that migrations write to.
create schema storage;
create table storage.buckets (id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]);

-- Supabase keeps extensions (pgvector) in schema "extensions", usable by the API roles.
create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated, service_role;
