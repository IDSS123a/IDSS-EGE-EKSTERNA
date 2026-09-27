-- Migration: 008_review_knowledge
-- Date: 2026-09-27
-- Author: ACA (Claude Code)
-- Description: Sprint 04 review and canonical knowledge (DATA_MODEL.md §4; PDL-015; AMB-09, AMB-10, AMB-16; CF-03).
--   * subjects: the three exam subjects (Pravilnik Art. 5), each backed by verbatim quotes of its active
--     catalogue edition; subject foreign keys for scoped grants and documents.
--   * canonical_rules (+ canonical_rule_reviews): exam rules with page quotes, confirmed or disputed by
--     the subject teacher.
--   * record_reviews: append-only trust decisions on ingested records (accept with confirmed task type,
--     return with reason). Acceptance creates the trusted copy in the same transaction:
--     questions, question_versions, subject_areas, answer_keys (printed key, never changed).
--   * answer_key_revisions: append-only reviewed corrections; the latest one is the effective key.
--   * Write functions are SECURITY INVOKER, service_role only, re-check the actor with the subject
--     scope and write the audit row in the same transaction.
-- Rollback:
--   drop function if exists public.load_canonical_facts(uuid, uuid, jsonb, inet),
--     public.decide_record_review(uuid, bigint, text, text, text, inet),
--     public.propose_answer_key_revision(uuid, uuid, text, text, text, inet),
--     public.decide_rule_review(uuid, uuid, text, text, inet),
--     private.actor_has_subject_capability(uuid, text, uuid);
--   drop table if exists public.answer_key_revisions, public.answer_keys, public.question_versions, public.questions,
--     public.subject_areas, public.record_reviews, public.canonical_rule_reviews, public.canonical_rules cascade;
--   alter table public.profile_bundles drop constraint if exists profile_bundles_scope_subject_fk,
--     drop constraint if exists profile_bundles_subject_scope_check;
--   alter table public.canonical_documents drop constraint if exists canonical_documents_scope_subject_fk;
--   drop table if exists public.subjects;

-- ---------------------------------------------------------------------------- subjects
create table public.subjects (
  id                uuid primary key default gen_random_uuid(),
  -- Exactly the three exam subjects of Pravilnik Art. 5 (P-3); codes match the ingested records.
  code              text not null unique check (code in ('bhs_language_literature', 'mathematics', 'german')),
  official_name     text not null check (length(official_name) between 3 and 200),
  legal_basis       text not null,
  source_version_id uuid not null references public.canonical_document_versions (id) on delete restrict,
  -- [{page, quote}] verbatim from the source version
  evidence          jsonb not null check (jsonb_typeof(evidence) = 'array' and jsonb_array_length(evidence) > 0),
  facts_version     integer not null check (facts_version > 0),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index subjects_source_version_idx on public.subjects (source_version_id);

alter table public.profile_bundles
  add constraint profile_bundles_scope_subject_fk foreign key (scope_subject_id) references public.subjects (id) on delete restrict,
  -- Subject teachers are always scoped to one subject; other bundles never are (ROLES_AND_PERMISSIONS §1).
  add constraint profile_bundles_subject_scope_check check ((bundle_code = 'subject_teacher') = (scope_subject_id is not null));
create index profile_bundles_scope_subject_idx on public.profile_bundles (scope_subject_id);
alter table public.canonical_documents
  add constraint canonical_documents_scope_subject_fk foreign key (scope_subject_id) references public.subjects (id) on delete restrict;
create index canonical_documents_scope_subject_idx on public.canonical_documents (scope_subject_id);

create table public.subject_areas (
  id                uuid primary key default gen_random_uuid(),
  subject_id        uuid not null references public.subjects (id) on delete restrict,
  source_version_id uuid not null references public.canonical_document_versions (id) on delete restrict,
  source_label      text not null,
  label             text not null,
  ordinal           integer not null check (ordinal > 0),
  unique (source_version_id, source_label)
);
create index subject_areas_subject_idx on public.subject_areas (subject_id);

-- ---------------------------------------------------------------------------- canonical rules
create table public.canonical_rules (
  id                uuid primary key default gen_random_uuid(),
  subject_id        uuid not null references public.subjects (id) on delete restrict,
  source_version_id uuid not null references public.canonical_document_versions (id) on delete restrict,
  rule_code         text not null check (rule_code ~ '^[a-z_]+\.[a-z_]+$'),
  value             jsonb not null check (jsonb_typeof(value) = 'object'),
  evidence          jsonb not null check (jsonb_typeof(evidence) = 'array' and jsonb_array_length(evidence) > 0),
  facts_version     integer not null check (facts_version > 0),
  loaded_by         uuid not null references public.profiles (user_id) on delete restrict,
  loaded_at         timestamptz not null default now(),
  unique (source_version_id, rule_code)
);
create index canonical_rules_subject_idx on public.canonical_rules (subject_id);
create index canonical_rules_loaded_by_idx on public.canonical_rules (loaded_by);

create table public.canonical_rule_reviews (
  id         uuid primary key default gen_random_uuid(),
  rule_id    uuid not null references public.canonical_rules (id) on delete restrict,
  subject_id uuid not null references public.subjects (id) on delete restrict,
  decision   text not null check (decision in ('confirmed', 'disputed')),
  note       text check (note is null or length(note) between 1 and 2000),
  reviewer   uuid not null references public.profiles (user_id) on delete restrict,
  decided_at timestamptz not null default now(),
  check (decision <> 'disputed' or note is not null)
);
create index canonical_rule_reviews_rule_idx on public.canonical_rule_reviews (rule_id, decided_at desc);
create index canonical_rule_reviews_subject_idx on public.canonical_rule_reviews (subject_id);
create index canonical_rule_reviews_reviewer_idx on public.canonical_rule_reviews (reviewer);

-- ---------------------------------------------------------------------------- record review
create table public.record_reviews (
  id         uuid primary key default gen_random_uuid(),
  record_id  bigint not null references public.ingested_records (id) on delete restrict,
  subject_id uuid not null references public.subjects (id) on delete restrict,
  decision   text not null check (decision in ('accepted', 'returned')),
  -- Task type confirmed by the reviewer (AMB-10); required on acceptance.
  task_type  text check (task_type is null or task_type ~ '^[a-z_]+$'),
  reason     text check (reason is null or length(reason) between 1 and 2000),
  reviewer   uuid not null references public.profiles (user_id) on delete restrict,
  decided_at timestamptz not null default now(),
  check (decision <> 'accepted' or task_type is not null),
  check (decision <> 'returned' or reason is not null)
);
create index record_reviews_record_idx on public.record_reviews (record_id, decided_at desc);
create unique index record_reviews_one_acceptance on public.record_reviews (record_id) where decision = 'accepted';
create index record_reviews_subject_idx on public.record_reviews (subject_id);
create index record_reviews_reviewer_idx on public.record_reviews (reviewer);

-- ---------------------------------------------------------------------------- trusted questions
create table public.questions (
  id         uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id) on delete restrict,
  stable_key text not null unique check (stable_key ~ '^[A-Z]{3}-[A-Z0-9.]+$'),
  created_at timestamptz not null default now()
);
create index questions_subject_idx on public.questions (subject_id);

create table public.question_versions (
  id                   uuid primary key default gen_random_uuid(),
  question_id          uuid not null references public.questions (id) on delete restrict,
  subject_id           uuid not null references public.subjects (id) on delete restrict,
  record_id            bigint not null unique references public.ingested_records (id) on delete restrict,
  review_id            uuid not null unique references public.record_reviews (id) on delete restrict,
  document_version_id  uuid not null references public.canonical_document_versions (id) on delete restrict,
  area_id              uuid references public.subject_areas (id) on delete restrict,
  original_number      text not null,
  record_kind          text not null,
  task_type            text not null check (task_type ~ '^[a-z_]+$'),
  catalogue_level      text,
  raw_text             text not null,
  stem_text            text,
  options              jsonb not null default '[]'::jsonb,
  -- scored items without their keys (keys live in answer_keys)
  scored_items         jsonb not null default '[]'::jsonb,
  sub_parts            jsonb not null default '[]'::jsonb,
  source_regions       jsonb not null,
  emphasis_spans       jsonb not null default '[]'::jsonb,
  notation_fidelity    text,
  has_figure_reference boolean not null default false,
  trust_status         text not null default 'trusted' check (trust_status = 'trusted'),
  created_at           timestamptz not null default now(),
  unique (question_id, document_version_id)
);
create index question_versions_subject_idx on public.question_versions (subject_id);
create index question_versions_document_version_idx on public.question_versions (document_version_id);
create index question_versions_area_idx on public.question_versions (area_id);

create table public.answer_keys (
  id                  uuid primary key default gen_random_uuid(),
  question_version_id uuid not null references public.question_versions (id) on delete restrict,
  subject_id          uuid not null references public.subjects (id) on delete restrict,
  -- null: key of the whole task; n: key of scored item n (German, 4 per task)
  item_number         integer check (item_number is null or item_number > 0),
  printed_answer      text not null,
  source              text
);
create unique index answer_keys_unique_item on public.answer_keys (question_version_id, coalesce(item_number, 0));
create index answer_keys_subject_idx on public.answer_keys (subject_id);

create table public.answer_key_revisions (
  id               uuid primary key default gen_random_uuid(),
  answer_key_id    uuid not null references public.answer_keys (id) on delete restrict,
  subject_id       uuid not null references public.subjects (id) on delete restrict,
  corrected_answer text not null check (length(corrected_answer) between 1 and 2000),
  reason           text not null check (length(reason) between 1 and 2000),
  evidence         text check (evidence is null or length(evidence) between 1 and 2000),
  proposed_by      uuid not null references public.profiles (user_id) on delete restrict,
  created_at       timestamptz not null default now()
);
create index answer_key_revisions_key_idx on public.answer_key_revisions (answer_key_id, created_at desc);
create index answer_key_revisions_subject_idx on public.answer_key_revisions (subject_id);
create index answer_key_revisions_proposed_by_idx on public.answer_key_revisions (proposed_by);

-- History and trusted copies are never changed or deleted (a correction is a new row).
create trigger canonical_rules_append_only before update or delete on public.canonical_rules
  for each row execute function public.reject_audit_mutation();
create trigger canonical_rule_reviews_append_only before update or delete on public.canonical_rule_reviews
  for each row execute function public.reject_audit_mutation();
create trigger record_reviews_append_only before update or delete on public.record_reviews
  for each row execute function public.reject_audit_mutation();
create trigger questions_append_only before update or delete on public.questions
  for each row execute function public.reject_audit_mutation();
create trigger question_versions_append_only before update or delete on public.question_versions
  for each row execute function public.reject_audit_mutation();
create trigger answer_keys_append_only before update or delete on public.answer_keys
  for each row execute function public.reject_audit_mutation();
create trigger answer_key_revisions_append_only before update or delete on public.answer_key_revisions
  for each row execute function public.reject_audit_mutation();

-- ---------------------------------------------------------------------------- row level security
alter table public.subjects               enable row level security;
alter table public.subject_areas          enable row level security;
alter table public.canonical_rules        enable row level security;
alter table public.canonical_rule_reviews enable row level security;
alter table public.record_reviews         enable row level security;
alter table public.questions              enable row level security;
alter table public.question_versions      enable row level security;
alter table public.answer_keys            enable row level security;
alter table public.answer_key_revisions   enable row level security;

-- Subject names and areas are shown to every active account.
create policy subjects_select on public.subjects for select to authenticated using (private.current_account_role() is not null);
create policy subject_areas_select on public.subject_areas for select to authenticated using (private.current_account_role() is not null);
-- Review material: publishers, and reviewers of that subject only. Students get trusted questions in Sprint 06.
create policy canonical_rules_select on public.canonical_rules for select to authenticated using (
  private.has_capability('canon.publish') or private.has_capability('canon.review', subject_id));
create policy canonical_rule_reviews_select on public.canonical_rule_reviews for select to authenticated using (
  private.has_capability('canon.publish') or private.has_capability('canon.review', subject_id));
create policy record_reviews_select on public.record_reviews for select to authenticated using (
  private.has_capability('canon.publish') or private.has_capability('canon.review', subject_id));
create policy questions_select on public.questions for select to authenticated using (
  private.has_capability('canon.publish') or private.has_capability('canon.review', subject_id));
create policy question_versions_select on public.question_versions for select to authenticated using (
  private.has_capability('canon.publish') or private.has_capability('canon.review', subject_id));
create policy answer_keys_select on public.answer_keys for select to authenticated using (
  private.has_capability('canon.publish') or private.has_capability('canon.review', subject_id));
create policy answer_key_revisions_select on public.answer_key_revisions for select to authenticated using (
  private.has_capability('canon.publish') or private.has_capability('canon.review', subject_id));

-- ---------------------------------------------------------------------------- actor check with subject scope
-- Role grants are unscoped; a bundle grant counts when it is unscoped or scoped to this subject.
create or replace function private.actor_has_subject_capability(actor uuid, capability text, subject uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    join public.role_capabilities rc on rc.role = p.role
    where p.user_id = actor and p.account_status = 'active' and rc.capability_code = capability
  ) or exists (
    select 1 from public.profiles p
    join public.profile_bundles pb on pb.profile_user_id = p.user_id
    join public.bundle_capabilities bc on bc.bundle_code = pb.bundle_code
    where p.user_id = actor and p.account_status = 'active' and bc.capability_code = capability
      and (pb.scope_subject_id is null or pb.scope_subject_id = subject)
  )
$$;
revoke all on function private.actor_has_subject_capability(uuid, text, uuid) from public, anon, authenticated;
grant execute on function private.actor_has_subject_capability(uuid, text, uuid) to service_role;

-- ---------------------------------------------------------------------------- load canonical facts
-- p_facts: {sha256, facts_version, subject: {code, official_name, legal_basis, evidence}, rules: [{code, value, evidence}]}.
-- The server has verified every quote against the stored file; the database re-checks the edition binding.
create or replace function public.load_canonical_facts(p_actor uuid, p_version_id uuid, p_facts jsonb, p_ip inet)
returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  v_version    public.canonical_document_versions%rowtype;
  v_type       text;
  v_document   uuid;
  v_subject_id uuid;
begin
  if not private.actor_has_capability(p_actor, 'canon.publish') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select * into v_version from public.canonical_document_versions where id = p_version_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  select d.type_code, d.id into v_type, v_document from public.canonical_documents d where d.id = v_version.document_id;
  if v_version.status not in ('active', 'validation_required') or v_type <> 'subject_catalogue' then
    raise exception 'INVALID_TRANSITION' using errcode = '22023';
  end if;
  if p_facts ->> 'sha256' is distinct from v_version.sha256 then
    raise exception 'INTEGRITY' using errcode = '22023';
  end if;
  if exists (select 1 from public.canonical_rules where source_version_id = p_version_id) then
    raise exception 'ALREADY_LOADED' using errcode = '23505';
  end if;
  if jsonb_array_length(coalesce(p_facts -> 'rules', '[]'::jsonb)) = 0 then
    raise exception 'VALIDATION' using errcode = '22023';
  end if;

  -- The subject row follows the newest loaded edition of its catalogue.
  insert into public.subjects (code, official_name, legal_basis, source_version_id, evidence, facts_version)
  values (p_facts -> 'subject' ->> 'code', p_facts -> 'subject' ->> 'official_name', p_facts -> 'subject' ->> 'legal_basis',
          p_version_id, p_facts -> 'subject' -> 'evidence', (p_facts ->> 'facts_version')::integer)
  on conflict (code) do update set official_name = excluded.official_name, legal_basis = excluded.legal_basis,
    source_version_id = excluded.source_version_id, evidence = excluded.evidence, facts_version = excluded.facts_version,
    updated_at = now()
  returning id into v_subject_id;

  update public.canonical_documents set scope_subject_id = v_subject_id where id = v_document;

  insert into public.canonical_rules (subject_id, source_version_id, rule_code, value, evidence, facts_version, loaded_by)
  select v_subject_id, p_version_id, rule ->> 'code', rule -> 'value', rule -> 'evidence', (p_facts ->> 'facts_version')::integer, p_actor
  from jsonb_array_elements(p_facts -> 'rules') as rules (rule);

  insert into public.canonical_dependencies (source_version_id, dependent_table, dependent_id)
  select p_version_id, 'canonical_rules', id::text from public.canonical_rules where source_version_id = p_version_id
  union all select p_version_id, 'subjects', v_subject_id::text;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address)
  values (p_actor, 'canon.facts_loaded', 'canonical_document_version', p_version_id::text,
          jsonb_build_object('subject', p_facts -> 'subject' ->> 'code', 'rules', jsonb_array_length(p_facts -> 'rules'),
                             'facts_version', (p_facts ->> 'facts_version')::integer), p_ip);
  return v_subject_id;
end;
$$;
revoke all on function public.load_canonical_facts(uuid, uuid, jsonb, inet) from public, anon, authenticated;
grant execute on function public.load_canonical_facts(uuid, uuid, jsonb, inet) to service_role;

-- ---------------------------------------------------------------------------- record review decision
-- Only records of the latest succeeded ingestion job of an active version are reviewed.
create or replace function public.decide_record_review(p_actor uuid, p_record_id bigint, p_decision text, p_task_type text, p_reason text, p_ip inet)
returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  v_record    public.ingested_records%rowtype;
  v_status    public.canon_version_status;
  v_latest    uuid;
  v_subject   uuid;
  v_review    uuid;
  v_question  uuid;
  v_qv        uuid;
  v_area      uuid;
  v_area_src  text;
  v_key       text;
  v_logic     jsonb;
begin
  select * into v_record from public.ingested_records where id = p_record_id;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  select id into v_subject from public.subjects where code = v_record.record ->> 'subject';
  if v_subject is null then
    raise exception 'SUBJECT_MISSING' using errcode = '22023';
  end if;
  if not private.actor_has_subject_capability(p_actor, 'canon.review', v_subject) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_decision not in ('accepted', 'returned')
     or (p_decision = 'accepted' and (p_task_type is null or p_task_type !~ '^[a-z_]+$'))
     or (p_decision = 'returned' and nullif(btrim(coalesce(p_reason, '')), '') is null) then
    raise exception 'VALIDATION' using errcode = '22023';
  end if;
  select status into v_status from public.canonical_document_versions where id = v_record.version_id;
  select j.id into v_latest from public.canonical_ingestion_jobs j
    where j.version_id = v_record.version_id and j.state = 'succeeded' order by j.finished_at desc limit 1;
  if v_status <> 'active' or v_latest is distinct from v_record.job_id then
    raise exception 'STALE_RECORD' using errcode = '22023';
  end if;
  if exists (select 1 from public.record_reviews r join public.ingested_records i on i.id = r.record_id
             where r.decision = 'accepted' and i.version_id = v_record.version_id and i.record_key = v_record.record_key) then
    raise exception 'ALREADY_ACCEPTED' using errcode = '23505';
  end if;
  if p_decision = 'accepted' and v_record.structural_status = 'failed' then
    raise exception 'NOT_ACCEPTABLE' using errcode = '22023';
  end if;

  insert into public.record_reviews (record_id, subject_id, decision, task_type, reason, reviewer)
  values (p_record_id, v_subject, p_decision, case when p_decision = 'accepted' then p_task_type end,
          nullif(btrim(coalesce(p_reason, '')), ''), p_actor)
  returning id into v_review;

  if p_decision = 'accepted' then
    v_logic := v_record.record -> 'logic';
    v_area_src := v_record.record -> 'source' -> 'section_path' ->> 0;
    if v_area_src is not null then
      insert into public.subject_areas (subject_id, source_version_id, source_label, label, ordinal)
      select v_subject, v_record.version_id, v_area_src, coalesce(v_record.record -> 'semantics' ->> 'area', v_area_src),
             (select min(i.ordinal) from public.ingested_records i
              where i.job_id = v_record.job_id and i.record -> 'source' -> 'section_path' ->> 0 = v_area_src)
      on conflict (source_version_id, source_label) do nothing;
      select id into v_area from public.subject_areas where source_version_id = v_record.version_id and source_label = v_area_src;
    end if;

    insert into public.questions (subject_id, stable_key) values (v_subject, v_record.record_key)
    on conflict (stable_key) do nothing;
    select id into v_question from public.questions where stable_key = v_record.record_key;

    insert into public.question_versions (question_id, subject_id, record_id, review_id, document_version_id, area_id,
      original_number, record_kind, task_type, catalogue_level, raw_text, stem_text, options, scored_items, sub_parts,
      source_regions, emphasis_spans, notation_fidelity, has_figure_reference)
    values (v_question, v_subject, p_record_id, v_review, v_record.version_id, v_area,
      v_record.record -> 'source' ->> 'original_number', v_record.record_kind, p_task_type,
      v_record.record -> 'semantics' ->> 'catalogue_level', v_record.record -> 'syntax' ->> 'raw_text',
      v_record.record -> 'syntax' ->> 'stem_text', coalesce(v_record.record -> 'syntax' -> 'options', '[]'::jsonb),
      coalesce((select jsonb_agg(item - 'answer_key_raw' order by ordinality)
                from jsonb_array_elements(coalesce(v_logic -> 'scored_items', '[]'::jsonb)) with ordinality as items (item, ordinality)), '[]'::jsonb),
      coalesce(v_logic -> 'sub_parts', '[]'::jsonb), coalesce(v_record.record -> 'source' -> 'regions', '[]'::jsonb),
      coalesce(v_record.record -> 'syntax' -> 'emphasis_spans', '[]'::jsonb), v_record.record -> 'syntax' ->> 'notation_fidelity',
      coalesce((v_record.record -> 'syntax' ->> 'has_figure_reference')::boolean, false))
    returning id into v_qv;

    -- Printed keys, exactly as extracted: per scored item when the task has items, else the task key.
    if jsonb_array_length(coalesce(v_logic -> 'scored_items', '[]'::jsonb)) > 0 then
      insert into public.answer_keys (question_version_id, subject_id, item_number, printed_answer, source)
      select v_qv, v_subject, (item ->> 'item_number')::integer, item ->> 'answer_key_raw', v_logic ->> 'answer_key_source'
      from jsonb_array_elements(v_logic -> 'scored_items') as items (item)
      where item ->> 'answer_key_raw' is not null;
    else
      v_key := v_logic ->> 'answer_key_raw';
      if v_key is not null then
        insert into public.answer_keys (question_version_id, subject_id, item_number, printed_answer, source)
        values (v_qv, v_subject, null, v_key, v_logic ->> 'answer_key_source');
      end if;
    end if;

    insert into public.canonical_dependencies (source_version_id, dependent_table, dependent_id)
    values (v_record.version_id, 'question_versions', v_qv::text);
  end if;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address)
  values (p_actor, case when p_decision = 'accepted' then 'review.record_accepted' else 'review.record_returned' end,
          'ingested_record', p_record_id::text,
          jsonb_build_object('record_key', v_record.record_key, 'subject', v_record.record ->> 'subject',
                             'task_type', p_task_type, 'question_version_id', v_qv), p_ip);
  return v_review;
end;
$$;
revoke all on function public.decide_record_review(uuid, bigint, text, text, text, inet) from public, anon, authenticated;
grant execute on function public.decide_record_review(uuid, bigint, text, text, text, inet) to service_role;

-- ---------------------------------------------------------------------------- answer-key revision
create or replace function public.propose_answer_key_revision(p_actor uuid, p_answer_key_id uuid, p_corrected text, p_reason text, p_evidence text, p_ip inet)
returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  v_subject  uuid;
  v_revision uuid;
begin
  select subject_id into v_subject from public.answer_keys where id = p_answer_key_id;
  if v_subject is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if not private.actor_has_subject_capability(p_actor, 'answer_keys.propose_revision', v_subject) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_corrected, '')), '') is null or nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'VALIDATION' using errcode = '22023';
  end if;
  insert into public.answer_key_revisions (answer_key_id, subject_id, corrected_answer, reason, evidence, proposed_by)
  values (p_answer_key_id, v_subject, btrim(p_corrected), btrim(p_reason), nullif(btrim(coalesce(p_evidence, '')), ''), p_actor)
  returning id into v_revision;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address)
  values (p_actor, 'review.answer_key_revised', 'answer_key', p_answer_key_id::text,
          jsonb_build_object('revision_id', v_revision), p_ip);
  return v_revision;
end;
$$;
revoke all on function public.propose_answer_key_revision(uuid, uuid, text, text, text, inet) from public, anon, authenticated;
grant execute on function public.propose_answer_key_revision(uuid, uuid, text, text, text, inet) to service_role;

-- ---------------------------------------------------------------------------- rule review
create or replace function public.decide_rule_review(p_actor uuid, p_rule_id uuid, p_decision text, p_note text, p_ip inet)
returns uuid
language plpgsql security invoker set search_path = ''
as $$
declare
  v_subject uuid;
  v_review  uuid;
begin
  select subject_id into v_subject from public.canonical_rules where id = p_rule_id;
  if v_subject is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if not private.actor_has_subject_capability(p_actor, 'canon.review', v_subject) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_decision not in ('confirmed', 'disputed') or (p_decision = 'disputed' and nullif(btrim(coalesce(p_note, '')), '') is null) then
    raise exception 'VALIDATION' using errcode = '22023';
  end if;
  insert into public.canonical_rule_reviews (rule_id, subject_id, decision, note, reviewer)
  values (p_rule_id, v_subject, p_decision, nullif(btrim(coalesce(p_note, '')), ''), p_actor)
  returning id into v_review;
  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address)
  values (p_actor, 'review.rule_' || p_decision, 'canonical_rule', p_rule_id::text, jsonb_build_object('review_id', v_review), p_ip);
  return v_review;
end;
$$;
revoke all on function public.decide_rule_review(uuid, uuid, text, text, inet) from public, anon, authenticated;
grant execute on function public.decide_rule_review(uuid, uuid, text, text, inet) to service_role;
