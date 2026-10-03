-- Migration: 028_teacher_notes
-- Date: 2026-10-03
-- Author: ACA (Claude Code)
-- Description: Sprint 09 (implementation plan row 09, ROLES §2 "Read/write teacher (academic) notes": superadministrator,
--   subject teacher scoped to the own subject, pedagogue, psychologist; never the student; DATA_MODEL §7, PDL-034).
--   Academic notes per student and subject: append-only, readable and writable with teacher_notes.read_write for that
--   subject; the audit row records the note's id and subject, never its content (M-15). Separate from support notes.
-- Rollback:
--   drop function if exists public.teacher_notes_of(uuid, uuid), public.teacher_note_add(uuid, uuid, text, text, inet);
--   drop table if exists public.teacher_notes;

create table public.teacher_notes (
  id         uuid primary key default gen_random_uuid(),
  person_id  uuid not null references public.persons (id) on delete restrict,
  subject_id uuid not null references public.subjects (id) on delete restrict,
  author     uuid not null references public.profiles (user_id) on delete restrict,
  body       text not null check (length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index teacher_notes_person_idx on public.teacher_notes (person_id, created_at desc);
create index teacher_notes_subject_idx on public.teacher_notes (subject_id);
create index teacher_notes_author_idx on public.teacher_notes (author);
create trigger teacher_notes_append_only before update or delete on public.teacher_notes
  for each row execute function public.reject_audit_mutation();
alter table public.teacher_notes enable row level security;
create policy teacher_notes_select on public.teacher_notes for select to authenticated using (
  private.has_capability('teacher_notes.read_write', subject_id));

-- Notes of one student in the subjects where the actor holds teacher_notes.read_write, newest first.
create or replace function public.teacher_notes_of(p_actor uuid, p_person uuid)
returns jsonb
language plpgsql stable set search_path = ''
as $$
begin
  if not private.actor_has_capability(p_actor, 'teacher_notes.read_write') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', n.id, 'subject', s.code, 'body', n.body, 'created_at', n.created_at, 'author', pr.display_name, 'own', n.author = p_actor)
           order by n.created_at desc), '[]'::jsonb)
    from public.teacher_notes n
    join public.subjects s on s.id = n.subject_id
    join public.profiles pr on pr.user_id = n.author
    where n.person_id = p_person and private.actor_has_subject_capability(p_actor, 'teacher_notes.read_write', n.subject_id));
end;
$$;
revoke all on function public.teacher_notes_of(uuid, uuid) from public, anon, authenticated;
grant execute on function public.teacher_notes_of(uuid, uuid) to service_role;

create or replace function public.teacher_note_add(p_actor uuid, p_person uuid, p_subject text, p_body text, p_ip inet)
returns uuid
language plpgsql set search_path = ''
as $$
declare
  v_subject uuid;
  v_id      uuid;
begin
  select id into v_subject from public.subjects where code = p_subject;
  if v_subject is null or length(btrim(coalesce(p_body, ''))) not between 1 and 4000 then
    raise exception 'VALIDATION' using errcode = '22023';
  end if;
  if not private.actor_has_subject_capability(p_actor, 'teacher_notes.read_write', v_subject) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if not exists (select 1 from public.persons pe join public.profiles pr on pr.user_id = pe.profile_user_id
                 where pe.id = p_person and pr.role = 'student') then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  insert into public.teacher_notes (person_id, subject_id, author, body)
  values (p_person, v_subject, p_actor, btrim(p_body)) returning id into v_id;
  -- The audit row never carries the note's content (M-15).
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address)
  values (p_actor, 'teacher.note_added', 'persons', p_person::text, jsonb_build_object('note', v_id, 'subject', p_subject), p_ip);
  return v_id;
end;
$$;
revoke all on function public.teacher_note_add(uuid, uuid, text, text, inet) from public, anon, authenticated;
grant execute on function public.teacher_note_add(uuid, uuid, text, text, inet) to service_role;
