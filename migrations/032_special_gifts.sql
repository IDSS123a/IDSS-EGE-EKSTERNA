-- Migration: 032_special_gifts
-- Date: 2026-10-03
-- Author: ACA (Claude Code)
-- Description: Sprint 09, special gifts (PDL-039, docs/architecture/SPECIAL_GIFTS.md). A subject teacher gives a student
--   one of six gifts with a personal message (G1, G2); no limit (G3); no IDSS points (G4); never shared outside the app
--   (G5). Seen by the student, the giving teacher, the pedagogue, the psychologist and the Director. Append-only; the
--   student's first opening is a separate row. The in-app notice is delivered once migration 030 allows 'gift_given'.
-- Rollback:
--   drop function if exists public.gift_give(uuid, uuid, text, text, inet), public.student_gifts(uuid),
--     public.gift_open(uuid, uuid), public.gifts_of_person(uuid, uuid), public.push_targets_of_gift(uuid),
--     private.gift_notify(uuid), private.actor_gives_gifts(uuid);
--   drop table if exists public.gift_openings, public.gifts;

create table public.gifts (
  id         uuid primary key default gen_random_uuid(),
  person_id  uuid not null references public.persons (id) on delete restrict,
  giver      uuid not null references public.profiles (user_id) on delete restrict,
  gift_code  text not null check (gift_code in ('crystal', 'icosahedron', 'quill_book', 'key', 'persistence', 'spark')),
  message    text not null check (length(btrim(message)) between 1 and 200),
  created_at timestamptz not null default now()
);
create table public.gift_openings (
  gift_id   uuid primary key references public.gifts (id) on delete restrict,
  opened_at timestamptz not null default now()
);
create index gifts_person_idx on public.gifts (person_id, created_at desc);
create index gifts_giver_idx on public.gifts (giver);
create trigger gifts_append_only before update or delete on public.gifts
  for each row execute function public.reject_audit_mutation();
create trigger gift_openings_append_only before update or delete on public.gift_openings
  for each row execute function public.reject_audit_mutation();
alter table public.gifts enable row level security;
alter table public.gift_openings enable row level security;
-- Direct reads only for the giving teacher; the student and the support roles read through the functions below.
create policy gifts_select on public.gifts for select to authenticated using (giver = (select auth.uid()));
create policy gift_openings_select on public.gift_openings for select to authenticated using (
  exists (select 1 from public.gifts g where g.id = gift_id and g.giver = (select auth.uid())));

-- G1: a subject teacher (an active account holding the subject_teacher bundle).
create or replace function private.actor_gives_gifts(actor uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles p join public.profile_bundles pb on pb.profile_user_id = p.user_id
                 where p.user_id = actor and p.account_status = 'active' and pb.bundle_code = 'subject_teacher')
$$;
revoke all on function private.actor_gives_gifts(uuid) from public, anon, authenticated;
grant execute on function private.actor_gives_gifts(uuid) to service_role;

-- In-app notice; skipped quietly until migration 030 allows the kind (then delivered).
create or replace function private.gift_notify(p_gift uuid)
returns void
language plpgsql set search_path = ''
as $$
begin
  insert into public.notifications (recipient_user_id, kind, entity_id, payload)
  select pe.profile_user_id, 'gift_given', g.id, '{}'::jsonb
  from public.gifts g join public.persons pe on pe.id = g.person_id
  where g.id = p_gift;
exception when check_violation then
  null;
end;
$$;
revoke all on function private.gift_notify(uuid) from public, anon, authenticated;
grant execute on function private.gift_notify(uuid) to service_role;

create or replace function public.gift_give(p_actor uuid, p_person uuid, p_code text, p_message text, p_ip inet)
returns uuid
language plpgsql set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not private.actor_gives_gifts(p_actor) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_code is null or p_code not in ('crystal', 'icosahedron', 'quill_book', 'key', 'persistence', 'spark')
     or length(btrim(coalesce(p_message, ''))) not between 1 and 200 then
    raise exception 'VALIDATION' using errcode = '22023';
  end if;
  if not exists (select 1 from public.persons pe join public.profiles pr on pr.user_id = pe.profile_user_id
                 where pe.id = p_person and pr.role = 'student' and pr.account_status = 'active') then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  insert into public.gifts (person_id, giver, gift_code, message) values (p_person, p_actor, p_code, btrim(p_message))
  returning id into v_id;
  -- The audit row names the gift, never the message (M-15).
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address)
  values (p_actor, 'gift.given', 'persons', p_person::text, jsonb_build_object('gift', v_id, 'code', p_code), p_ip);
  perform private.gift_notify(v_id);
  return v_id;
end;
$$;
revoke all on function public.gift_give(uuid, uuid, text, text, inet) from public, anon, authenticated;
grant execute on function public.gift_give(uuid, uuid, text, text, inet) to service_role;

-- The student's own gifts, newest first, with the giver and whether it was opened.
create or replace function public.student_gifts(p_actor uuid)
returns jsonb
language plpgsql stable set search_path = ''
as $$
declare
  v_person uuid := private.practice_person(p_actor);
begin
  return (
    select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'code', g.gift_code, 'message', g.message, 'giver', pr.display_name,
             'created_at', g.created_at, 'opened_at', o.opened_at) order by g.created_at desc), '[]'::jsonb)
    from public.gifts g
    join public.profiles pr on pr.user_id = g.giver
    left join public.gift_openings o on o.gift_id = g.id
    where g.person_id = v_person);
end;
$$;
revoke all on function public.student_gifts(uuid) from public, anon, authenticated;
grant execute on function public.student_gifts(uuid) to service_role;

-- The student opens an own gift for the first time (the unboxing); later calls change nothing.
create or replace function public.gift_open(p_actor uuid, p_gift uuid)
returns void
language plpgsql set search_path = ''
as $$
declare
  v_person uuid := private.practice_person(p_actor);
begin
  if not exists (select 1 from public.gifts where id = p_gift and person_id = v_person) then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  insert into public.gift_openings (gift_id) values (p_gift) on conflict (gift_id) do nothing;
end;
$$;
revoke all on function public.gift_open(uuid, uuid) from public, anon, authenticated;
grant execute on function public.gift_open(uuid, uuid) to service_role;

-- Gifts of one student for staff: all of them for unscoped monitoring (pedagogue, psychologist, Director), only the
-- own ones for a teacher; nobody else.
create or replace function public.gifts_of_person(p_actor uuid, p_person uuid)
returns jsonb
language plpgsql stable set search_path = ''
as $$
declare
  v_all boolean := private.actor_has_unscoped_capability(p_actor, 'students.view_progress');
begin
  if not v_all and not private.actor_gives_gifts(p_actor) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'code', g.gift_code, 'message', g.message, 'giver', pr.display_name,
             'created_at', g.created_at, 'opened_at', o.opened_at, 'own', g.giver = p_actor) order by g.created_at desc), '[]'::jsonb)
    from public.gifts g
    join public.profiles pr on pr.user_id = g.giver
    left join public.gift_openings o on o.gift_id = g.id
    where g.person_id = p_person and (v_all or g.giver = p_actor));
end;
$$;
revoke all on function public.gifts_of_person(uuid, uuid) from public, anon, authenticated;
grant execute on function public.gifts_of_person(uuid, uuid) to service_role;

-- Subscribed browsers of the gift's student, for the Web Push notice (PDL-037).
create or replace function public.push_targets_of_gift(p_gift uuid)
returns jsonb
language sql stable set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('endpoint', ps.endpoint, 'p256dh', ps.p256dh, 'auth', ps.auth)), '[]'::jsonb)
  from public.gifts g
  join public.persons pe on pe.id = g.person_id
  join public.profiles p on p.user_id = pe.profile_user_id and p.account_status = 'active'
  join public.push_subscriptions ps on ps.user_id = p.user_id
  where g.id = p_gift;
$$;
revoke all on function public.push_targets_of_gift(uuid) from public, anon, authenticated;
grant execute on function public.push_targets_of_gift(uuid) to service_role;
