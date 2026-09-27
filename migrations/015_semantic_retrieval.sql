-- Migration: 015_semantic_retrieval
-- Date: 2026-09-27
-- Author: ACA (Claude Code)
-- Description: Semantic search over trusted canon with Gemini embeddings (Sprint 06 item 2; PDL-017, PDL-023).
--   * pgvector in schema extensions.
--   * canonical_chunk_embeddings: one 768-dimension vector per chunk and embedding model, bound to the chunk text by
--     SHA-256 (a vector is stored only for the exact text it was computed from). Append-only; a new model adds rows.
--   * pending_chunk_embeddings(): chunks of active versions without a vector for the model (canon.publish).
--   * store_chunk_embeddings(): validated batch insert, audited (canon.publish).
--   * retrieve_canon_semantic(): scope first (active version, current rule edition, actor's subjects), then rank by
--     reciprocal rank fusion of vector similarity and the full-text rank of migration 011; audited with the query hash
--     only. Returns similarity and keyword rank so the application can refuse when nothing is relevant.
--   * retrieval_audit_logs.method records which ranking answered.
--   Only catalogue text and query text are sent to Google by the application; no personal data is embedded.
-- Rollback:
--   drop function if exists public.retrieve_canon_semantic(uuid, text, real[], text, uuid, integer),
--     public.store_chunk_embeddings(uuid, text, jsonb, inet), public.pending_chunk_embeddings(uuid, text, integer);
--   drop table if exists public.canonical_chunk_embeddings;
--   alter table public.retrieval_audit_logs drop column if exists method;
--   drop extension if exists vector;

create schema if not exists extensions;
create extension if not exists vector with schema extensions;

alter table public.retrieval_audit_logs
  add column method text not null default 'full_text' check (method in ('full_text', 'semantic'));

create table public.canonical_chunk_embeddings (
  chunk_id       uuid not null references public.canonical_chunks (id) on delete restrict,
  subject_id     uuid not null references public.subjects (id) on delete restrict,
  model          text not null check (model ~ '^[a-z0-9][a-z0-9.-]{1,62}$'),
  embedding      extensions.vector(768) not null,
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  created_by     uuid not null references public.profiles (user_id) on delete restrict,
  created_at     timestamptz not null default now(),
  primary key (chunk_id, model)
);
create index canonical_chunk_embeddings_subject_idx on public.canonical_chunk_embeddings (subject_id);
create index canonical_chunk_embeddings_created_by_idx on public.canonical_chunk_embeddings (created_by);
create index canonical_chunk_embeddings_vector_idx on public.canonical_chunk_embeddings
  using hnsw (embedding extensions.vector_cosine_ops);

create trigger canonical_chunk_embeddings_append_only before update or delete on public.canonical_chunk_embeddings
  for each row execute function public.reject_audit_mutation();

alter table public.canonical_chunk_embeddings enable row level security;
create policy canonical_chunk_embeddings_select on public.canonical_chunk_embeddings for select to authenticated using (
  private.has_capability('canon.publish') or private.has_capability('canon.review', subject_id));

-- ---------------------------------------------------------------------------- pending
create or replace function public.pending_chunk_embeddings(p_actor uuid, p_model text, p_limit integer)
returns table (chunk_id uuid, title text, content text, content_sha256 text)
language plpgsql security invoker set search_path = ''
as $$
begin
  if not private.actor_has_capability(p_actor, 'canon.publish') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_model is null or p_model !~ '^[a-z0-9][a-z0-9.-]{1,62}$' or p_limit is null or p_limit not between 1 and 200 then
    raise exception 'VALIDATION' using errcode = '22023';
  end if;
  return query
  select c.id, coalesce(c.citation ->> 'official_title', 'none'), c.content, encode(sha256(convert_to(c.content, 'UTF8')), 'hex')
  from public.canonical_chunks c
  join public.canonical_document_versions v on v.id = c.document_version_id and v.status = 'active'
  where not exists (select 1 from public.canonical_chunk_embeddings e where e.chunk_id = c.id and e.model = p_model)
  order by c.id
  limit p_limit;
end;
$$;
revoke all on function public.pending_chunk_embeddings(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.pending_chunk_embeddings(uuid, text, integer) to service_role;

-- ---------------------------------------------------------------------------- store
-- p_rows: [{chunk_id, content_sha256, embedding: [768 numbers]}]; every row must match the chunk's current text.
create or replace function public.store_chunk_embeddings(p_actor uuid, p_model text, p_rows jsonb, p_ip inet)
returns integer
language plpgsql security invoker set search_path = ''
as $$
declare
  v_stored integer;
begin
  if not private.actor_has_capability(p_actor, 'canon.publish') then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_model is null or p_model !~ '^[a-z0-9][a-z0-9.-]{1,62}$'
     or p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) not between 1 and 200 then
    raise exception 'VALIDATION' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_rows) r
    left join public.canonical_chunks c on c.id::text = r ->> 'chunk_id'
    where c.id is null
       or jsonb_typeof(r -> 'embedding') is distinct from 'array'
       or jsonb_array_length(r -> 'embedding') <> 768
       or r ->> 'content_sha256' is distinct from encode(sha256(convert_to(c.content, 'UTF8')), 'hex')
       or exists (select 1 from jsonb_array_elements(r -> 'embedding') x where jsonb_typeof(x) <> 'number')
  ) then
    raise exception 'VALIDATION' using errcode = '22023';
  end if;

  insert into public.canonical_chunk_embeddings (chunk_id, subject_id, model, embedding, content_sha256, created_by)
  select c.id, c.subject_id, p_model,
         (select array_agg(x::real order by n) from jsonb_array_elements_text(r -> 'embedding') with ordinality as e (x, n))::extensions.vector,
         r ->> 'content_sha256', p_actor
  from jsonb_array_elements(p_rows) r
  join public.canonical_chunks c on c.id::text = r ->> 'chunk_id'
  on conflict do nothing;
  get diagnostics v_stored = row_count;

  insert into public.audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address)
  values (p_actor, 'retrieval.embeddings_stored', 'canonical_chunks', null,
          jsonb_build_object('model', p_model, 'stored', v_stored), p_ip);
  return v_stored;
end;
$$;
revoke all on function public.store_chunk_embeddings(uuid, text, jsonb, inet) from public, anon, authenticated;
grant execute on function public.store_chunk_embeddings(uuid, text, jsonb, inet) to service_role;

-- ---------------------------------------------------------------------------- retrieve
create or replace function public.retrieve_canon_semantic(p_actor uuid, p_query text, p_embedding real[], p_model text, p_subject_id uuid, p_k integer)
returns table (chunk_id uuid, source_kind text, source_id uuid, subject_id uuid, document_version_id uuid,
               page integer, citation jsonb, content text, rank real, similarity real, keyword_rank real)
language plpgsql security invoker set search_path = ''
as $$
declare
  v_vector  extensions.vector;
  v_terms   tsquery[];
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
  if p_query is null or length(btrim(p_query)) not between 2 and 500 or p_k is null or p_k not between 1 and 10
     or p_model is null or p_model !~ '^[a-z0-9][a-z0-9.-]{1,62}$'
     or p_embedding is null or cardinality(p_embedding) <> 768 or array_position(p_embedding, null) is not null then
    raise exception 'VALIDATION' using errcode = '22023';
  end if;

  v_vector := p_embedding::extensions.vector;
  -- The query is data: reduced to letter/digit tokens, never concatenated into SQL (migration 011).
  select coalesce(array_agg(to_tsquery('simple'::regconfig, term)), '{}') into v_terms from unnest(private.search_terms(p_query)) as terms (term);
  v_query := private.search_query(p_query);

  with scoped as (
    select c.id, c.source_kind, c.source_id, c.subject_id, c.document_version_id, c.page, c.citation, c.content, c.search
    from public.canonical_chunks c
    join public.canonical_document_versions v on v.id = c.document_version_id and v.status = 'active'
    join public.subjects s on s.id = c.subject_id
    where (p_subject_id is null or c.subject_id = p_subject_id)
      and (c.source_kind <> 'canonical_rule' or c.document_version_id = s.source_version_id)
      and (private.actor_has_capability(p_actor, 'canon.publish') or private.actor_has_subject_capability(p_actor, 'canon.review', c.subject_id))
  ), semantic as (
    select sc.id, (1 - (e.embedding operator(extensions.<=>) v_vector))::real as similarity,
           row_number() over (order by e.embedding operator(extensions.<=>) v_vector, sc.id) as position
    from scoped sc
    join public.canonical_chunk_embeddings e on e.chunk_id = sc.id and e.model = p_model
    order by position
    limit 40
  ), keyword as (
    select ranked.id, ranked.keyword_rank, row_number() over (order by ranked.keyword_rank desc, ranked.id) as position
    from (
      select sc.id, ((select count(*) from unnest(v_terms) as term where sc.search @@ term) + ts_rank_cd(sc.search, v_query))::real as keyword_rank
      from scoped sc
      where numnode(v_query) > 0 and sc.search @@ v_query
    ) ranked
    order by position
    limit 40
  ), fused as (
    select coalesce(se.id, kw.id) as id,
           (coalesce(1.0 / (60 + se.position), 0) + coalesce(1.0 / (60 + kw.position), 0))::real as rank,
           se.similarity, kw.keyword_rank
    from semantic se
    full join keyword kw on kw.id = se.id
  )
  select coalesce(jsonb_agg(to_jsonb(result) order by result.rank desc, result.chunk_id), '[]'::jsonb) into v_results
  from (
    select sc.id as chunk_id, sc.source_kind, sc.source_id, sc.subject_id, sc.document_version_id, sc.page, sc.citation, sc.content,
           f.rank, f.similarity, f.keyword_rank
    from fused f
    join scoped sc on sc.id = f.id
    order by f.rank desc, sc.id
    limit p_k
  ) result;

  select coalesce(array_agg((element ->> 'chunk_id')::uuid), '{}') into v_ids from jsonb_array_elements(v_results) element;
  insert into public.retrieval_audit_logs (actor_user_id, query_sha256, subject_id, k, returned, method)
  values (p_actor, encode(sha256(convert_to(p_query, 'UTF8')), 'hex'), p_subject_id, p_k, v_ids, 'semantic');

  return query
  select (element ->> 'chunk_id')::uuid, element ->> 'source_kind', (element ->> 'source_id')::uuid, (element ->> 'subject_id')::uuid,
         (element ->> 'document_version_id')::uuid, (element ->> 'page')::integer, element -> 'citation', element ->> 'content',
         (element ->> 'rank')::real, (element ->> 'similarity')::real, (element ->> 'keyword_rank')::real
  from jsonb_array_elements(v_results) with ordinality as rows (element, ordinality)
  order by ordinality;
end;
$$;
revoke all on function public.retrieve_canon_semantic(uuid, text, real[], text, uuid, integer) from public, anon, authenticated;
grant execute on function public.retrieve_canon_semantic(uuid, text, real[], text, uuid, integer) to service_role;
