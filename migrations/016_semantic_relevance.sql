-- Migration: 016_semantic_relevance
-- Date: 2026-09-27
-- Author: ACA (Claude Code)
-- Description: Relevance of semantic results measured per query (PDL-023 addendum 3). Director: the query "Ministar"
--   returned unrelated passages. Measured on the live index: unrelated passages (different subjects) have cosine
--   similarity 0.736 median, 0.787 at the 99th percentile, so the absolute floor 0.6 let everything through.
--   * retrieve_canon_semantic() also returns similarity_z: how many standard deviations a passage's similarity lies
--     above the mean similarity of all passages in scope for the same query.
--   * retrieval_audit_logs.top_similarity and top_similarity_z: two numbers per semantic search (no query text), so the
--     floor is tuned on real searches.
-- Rollback: re-apply retrieve_canon_semantic of migration 015 (after dropping this one) and drop the two columns.

alter table public.retrieval_audit_logs
  add column top_similarity real,
  add column top_similarity_z real;

drop function if exists public.retrieve_canon_semantic(uuid, text, real[], text, uuid, integer);
create or replace function public.retrieve_canon_semantic(p_actor uuid, p_query text, p_embedding real[], p_model text, p_subject_id uuid, p_k integer)
returns table (chunk_id uuid, source_kind text, source_id uuid, subject_id uuid, document_version_id uuid,
               page integer, citation jsonb, content text, rank real, similarity real, keyword_rank real, similarity_z real)
language plpgsql security invoker set search_path = ''
as $$
declare
  v_vector  extensions.vector;
  v_terms   tsquery[];
  v_query   tsquery;
  v_results jsonb;
  v_ids     uuid[];
  v_mean    real;
  v_sd      real;
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

  -- How far a passage stands out for this query: its similarity against the similarity of every passage in scope
  -- (Gemini vectors are all close to each other, so an absolute floor cannot separate relevant from unrelated).
  select avg(1 - (e.embedding operator(extensions.<=>) v_vector))::real, stddev_samp(1 - (e.embedding operator(extensions.<=>) v_vector))::real
  into v_mean, v_sd
  from public.canonical_chunks c
  join public.canonical_document_versions v on v.id = c.document_version_id and v.status = 'active'
  join public.subjects s on s.id = c.subject_id
  join public.canonical_chunk_embeddings e on e.chunk_id = c.id and e.model = p_model
  where (p_subject_id is null or c.subject_id = p_subject_id)
    and (c.source_kind <> 'canonical_rule' or c.document_version_id = s.source_version_id)
    and (private.actor_has_capability(p_actor, 'canon.publish') or private.actor_has_subject_capability(p_actor, 'canon.review', c.subject_id));

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
           se.similarity, kw.keyword_rank,
           case when v_sd > 0 and se.similarity is not null then ((se.similarity - v_mean) / v_sd)::real end as similarity_z
    from semantic se
    full join keyword kw on kw.id = se.id
  )
  select coalesce(jsonb_agg(to_jsonb(result) order by result.rank desc, result.chunk_id), '[]'::jsonb) into v_results
  from (
    select sc.id as chunk_id, sc.source_kind, sc.source_id, sc.subject_id, sc.document_version_id, sc.page, sc.citation, sc.content,
           f.rank, f.similarity, f.keyword_rank, f.similarity_z
    from fused f
    join scoped sc on sc.id = f.id
    order by f.rank desc, sc.id
    limit p_k
  ) result;

  select coalesce(array_agg((element ->> 'chunk_id')::uuid), '{}') into v_ids from jsonb_array_elements(v_results) element;
  insert into public.retrieval_audit_logs (actor_user_id, query_sha256, subject_id, k, returned, method, top_similarity, top_similarity_z)
  values (p_actor, encode(sha256(convert_to(p_query, 'UTF8')), 'hex'), p_subject_id, p_k, v_ids, 'semantic',
          (select max((element ->> 'similarity')::real) from jsonb_array_elements(v_results) element),
          (select max((element ->> 'similarity_z')::real) from jsonb_array_elements(v_results) element));

  return query
  select (element ->> 'chunk_id')::uuid, element ->> 'source_kind', (element ->> 'source_id')::uuid, (element ->> 'subject_id')::uuid,
         (element ->> 'document_version_id')::uuid, (element ->> 'page')::integer, element -> 'citation', element ->> 'content',
         (element ->> 'rank')::real, (element ->> 'similarity')::real, (element ->> 'keyword_rank')::real, (element ->> 'similarity_z')::real
  from jsonb_array_elements(v_results) with ordinality as rows (element, ordinality)
  order by ordinality;
end;
$$;
revoke all on function public.retrieve_canon_semantic(uuid, text, real[], text, uuid, integer) from public, anon, authenticated;
grant execute on function public.retrieve_canon_semantic(uuid, text, real[], text, uuid, integer) to service_role;
