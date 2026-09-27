-- Migration: 009_retrieval
-- Date: 2026-09-27
-- Author: ACA (Claude Code)
-- Description: Sprint 05 retrieval over trusted canon (ARCHITECTURE.md §6; DATA_MODEL §5; PDL-017).
--   * private.fold_text(): lower case and diacritic folding (č ć đ š ž, ä ö ü ß) so a search without
--     diacritics finds the canonical text; immutable, used by the generated search vector.
--   * canonical_chunks: one chunk per trusted question version and per confirmed canonical rule, with
--     subject, document version, page and citation. Never built from untrusted records, never contains
--     answer keys. Append-only (sources are immutable); rebuild adds what is missing.
--   * retrieval_audit_logs: every retrieval with actor, SHA-256 of the query (never the text), filters
--     and returned chunk ids. Append-only.
--   * rebuild_canon_chunks(): canon.publish; retrieve_canon(): filters active versions and the actor's
--     subjects before ranking, bounded k, audited. Both SECURITY INVOKER, service_role only.
--   Embeddings (Gemini, DL-005) are added later as a separate table and ranking path (PDL-017).
-- Rollback:
--   drop function if exists public.retrieve_canon(uuid, text, uuid, integer), public.rebuild_canon_chunks(uuid, inet);
--   drop table if exists public.retrieval_audit_logs, public.canonical_chunks;
--   drop function if exists private.fold_text(text);

-- ---------------------------------------------------------------------------- text folding
create or replace function private.fold_text(value text)
returns text
language sql immutable parallel safe set search_path = ''
as $$
  select replace(replace(lower(translate(coalesce(value, ''), 'ČĆĐŠŽÄÖÜčćđšžäöü', 'CCDSZAOUccdszaou')), 'ß', 'ss'), 'ẞ', 'ss')
$$;
revoke all on function private.fold_text(text) from public, anon;
grant execute on function private.fold_text(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------- chunks
create table public.canonical_chunks (
  id                  uuid primary key default gen_random_uuid(),
  source_kind         text not null check (source_kind in ('question_version', 'canonical_rule')),
  source_id           uuid not null,
  subject_id          uuid not null references public.subjects (id) on delete restrict,
  document_version_id uuid not null references public.canonical_document_versions (id) on delete restrict,
  page                integer check (page is null or page > 0),
  -- {record_key | rule_code, page(s), area, official_title}: what an answer cites
  citation            jsonb not null,
  content             text not null check (length(content) between 1 and 20000),
  search              tsvector generated always as (to_tsvector('simple'::regconfig, private.fold_text(content))) stored,
  built_by            uuid not null references public.profiles (user_id) on delete restrict,
  built_at            timestamptz not null default now(),
  unique (source_kind, source_id)
);
create index canonical_chunks_search_idx on public.canonical_chunks using gin (search);
create index canonical_chunks_subject_idx on public.canonical_chunks (subject_id);
create index canonical_chunks_document_version_idx on public.canonical_chunks (document_version_id);
create index canonical_chunks_built_by_idx on public.canonical_chunks (built_by);

create table public.retrieval_audit_logs (
  id            bigint generated always as identity primary key,
  actor_user_id uuid not null references public.profiles (user_id) on delete restrict,
  query_sha256  text not null check (query_sha256 ~ '^[0-9a-f]{64}$'),
  subject_id    uuid references public.subjects (id) on delete restrict,
  k             integer not null check (k > 0),
  returned      uuid[] not null default '{}',
  created_at    timestamptz not null default now()
);
create index retrieval_audit_logs_actor_idx on public.retrieval_audit_logs (actor_user_id, created_at desc);
create index retrieval_audit_logs_subject_idx on public.retrieval_audit_logs (subject_id);

create trigger canonical_chunks_append_only before update or delete on public.canonical_chunks
  for each row execute function public.reject_audit_mutation();
create trigger retrieval_audit_logs_append_only before update or delete on public.retrieval_audit_logs
  for each row execute function public.reject_audit_mutation();

alter table public.canonical_chunks     enable row level security;
alter table public.retrieval_audit_logs enable row level security;
-- Chunks are read through retrieve_canon() only; publishers and reviewers of the subject may inspect them.
create policy canonical_chunks_select on public.canonical_chunks for select to authenticated using (
  private.has_capability('canon.publish') or private.has_capability('canon.review', subject_id));
create policy retrieval_audit_logs_select on public.retrieval_audit_logs for select to authenticated using (
  private.has_capability('audit.view'));

-- ---------------------------------------------------------------------------- build
-- Adds a chunk for every trusted question version and every rule whose latest review is "confirmed",
-- of active versions only. Existing chunks stay (their sources never change).
create or replace function public.rebuild_canon_chunks(p_actor uuid, p_ip inet)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_questions integer;
  v_rules     integer;
begin
  if not private.actor_has_capability(p_actor, 'canon.publish') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  with inserted as (
    insert into public.canonical_chunks (source_kind, source_id, subject_id, document_version_id, page, citation, content, built_by)
    select 'question_version', qv.id, qv.subject_id, qv.document_version_id,
           (qv.source_regions -> 0 ->> 'page')::integer,
           jsonb_build_object('record_key', q.stable_key, 'page', (qv.source_regions -> 0 ->> 'page')::integer,
                              'area', a.label, 'official_title', v.official_title),
           concat_ws(E'\n', a.label, qv.catalogue_level, qv.raw_text),
           p_actor
    from public.question_versions qv
    join public.questions q on q.id = qv.question_id
    join public.canonical_document_versions v on v.id = qv.document_version_id and v.status = 'active'
    left join public.subject_areas a on a.id = qv.area_id
    where not exists (select 1 from public.canonical_chunks c where c.source_kind = 'question_version' and c.source_id = qv.id)
    returning id, document_version_id
  ), deps as (
    insert into public.canonical_dependencies (source_version_id, dependent_table, dependent_id)
    select document_version_id, 'canonical_chunks', id::text from inserted
    returning 1
  )
  select count(*) into v_questions from deps;

  with confirmed as (
    select distinct on (rr.rule_id) rr.rule_id, rr.decision from public.canonical_rule_reviews rr order by rr.rule_id, rr.decided_at desc
  ), inserted as (
    insert into public.canonical_chunks (source_kind, source_id, subject_id, document_version_id, page, citation, content, built_by)
    select 'canonical_rule', r.id, r.subject_id, r.source_version_id,
           (r.evidence -> 0 ->> 'page')::integer,
           jsonb_build_object('rule_code', r.rule_code,
                              'pages', (select jsonb_agg(distinct (e ->> 'page')::integer) from jsonb_array_elements(r.evidence) e),
                              'official_title', v.official_title),
           (select string_agg(e ->> 'quote', E'\n' order by ordinality) from jsonb_array_elements(r.evidence) with ordinality as ev (e, ordinality)),
           p_actor
    from public.canonical_rules r
    join confirmed c on c.rule_id = r.id and c.decision = 'confirmed'
    join public.canonical_document_versions v on v.id = r.source_version_id and v.status = 'active'
    where not exists (select 1 from public.canonical_chunks x where x.source_kind = 'canonical_rule' and x.source_id = r.id)
    returning id, document_version_id
  ), deps as (
    insert into public.canonical_dependencies (source_version_id, dependent_table, dependent_id)
    select document_version_id, 'canonical_chunks', id::text from inserted
    returning 1
  )
  select count(*) into v_rules from deps;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address)
  values (p_actor, 'retrieval.index_built', 'canonical_chunks', null,
          jsonb_build_object('question_chunks_added', v_questions, 'rule_chunks_added', v_rules), p_ip);
  return jsonb_build_object('question_chunks_added', v_questions, 'rule_chunks_added', v_rules,
                            'total', (select count(*) from public.canonical_chunks));
end;
$$;
revoke all on function public.rebuild_canon_chunks(uuid, inet) from public, anon, authenticated;
grant execute on function public.rebuild_canon_chunks(uuid, inet) to service_role;

-- ---------------------------------------------------------------------------- retrieve
-- Scope first (active version, current rule edition, actor's subjects), then rank. Audited.
create or replace function public.retrieve_canon(p_actor uuid, p_query text, p_subject_id uuid, p_k integer)
returns table (chunk_id uuid, source_kind text, source_id uuid, subject_id uuid, document_version_id uuid,
               page integer, citation jsonb, content text, rank real)
language plpgsql security invoker set search_path = ''
as $$
declare
  v_query   tsquery;
  v_results jsonb;
  v_ids     uuid[];
begin
  if p_subject_id is not null then
    if not (private.actor_has_capability(p_actor, 'canon.publish') or private.actor_has_subject_capability(p_actor, 'canon.review', p_subject_id)) then
      raise exception 'FORBIDDEN' using errcode = '42501';
    end if;
  elsif not (private.actor_has_capability(p_actor, 'canon.publish') or private.actor_has_capability(p_actor, 'canon.review')) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_query is null or length(btrim(p_query)) not between 2 and 500 or p_k is null or p_k not between 1 and 10 then
    raise exception 'VALIDATION' using errcode = '22023';
  end if;

  -- The query is data: parsed by websearch_to_tsquery, never concatenated into SQL.
  v_query := websearch_to_tsquery('simple'::regconfig, private.fold_text(p_query));

  select coalesce(jsonb_agg(to_jsonb(ranked) order by ranked.rank desc, ranked.chunk_id), '[]'::jsonb) into v_results
  from (
    select c.id as chunk_id, c.source_kind, c.source_id, c.subject_id, c.document_version_id, c.page, c.citation, c.content,
           ts_rank_cd(c.search, v_query) as rank
    from public.canonical_chunks c
    join public.canonical_document_versions v on v.id = c.document_version_id and v.status = 'active'
    join public.subjects s on s.id = c.subject_id
    where numnode(v_query) > 0
      and c.search @@ v_query
      and (p_subject_id is null or c.subject_id = p_subject_id)
      -- rules only from the subject's current edition
      and (c.source_kind <> 'canonical_rule' or c.document_version_id = s.source_version_id)
      and (private.actor_has_capability(p_actor, 'canon.publish') or private.actor_has_subject_capability(p_actor, 'canon.review', c.subject_id))
    order by rank desc, c.id
    limit p_k
  ) ranked;

  select coalesce(array_agg((element ->> 'chunk_id')::uuid), '{}') into v_ids from jsonb_array_elements(v_results) element;
  insert into public.retrieval_audit_logs (actor_user_id, query_sha256, subject_id, k, returned)
  values (p_actor, encode(sha256(convert_to(p_query, 'UTF8')), 'hex'), p_subject_id, p_k, v_ids);

  return query
  select (element ->> 'chunk_id')::uuid, element ->> 'source_kind', (element ->> 'source_id')::uuid, (element ->> 'subject_id')::uuid,
         (element ->> 'document_version_id')::uuid, (element ->> 'page')::integer, element -> 'citation', element ->> 'content',
         (element ->> 'rank')::real
  from jsonb_array_elements(v_results) with ordinality as rows (element, ordinality)
  order by ordinality;
end;
$$;
revoke all on function public.retrieve_canon(uuid, text, uuid, integer) from public, anon, authenticated;
grant execute on function public.retrieve_canon(uuid, text, uuid, integer) to service_role;
