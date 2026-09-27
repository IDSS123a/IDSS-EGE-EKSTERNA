-- Migration: 010_retrieval_query
-- Date: 2026-09-27
-- Author: ACA (Claude Code)
-- Description: Sprint 05 fix found in the live check of 009: websearch_to_tsquery joins every word with AND,
--   so a natural question ("koliko traje ispit minuta") found nothing. private.search_query() builds an OR query
--   of the folded words; words of 5+ letters match by prefix (all but the last two letters, at least 4), which
--   covers Bosnian and German inflection ("trajanje" / "traje", "minuta" / "minute"). Tokens are letters and
--   digits only, so the query text can never inject tsquery syntax. Ranking (ts_rank_cd) prefers chunks that
--   match more words; the application applies a relevance floor.
-- Rollback: re-apply retrieve_canon from 009; drop function if exists private.search_query(text);

create or replace function private.search_query(value text)
returns tsquery
language sql immutable parallel safe set search_path = ''
as $$
  select coalesce(
    to_tsquery('simple'::regconfig, string_agg(
      case when length(word) >= 5 then left(word, greatest(4, length(word) - 2)) || ':*' else word end, ' | ')),
    ''::tsquery)
  from regexp_split_to_table(private.fold_text(value), '[^[:alnum:]]+') as words (word)
  where length(word) >= 2
$$;
revoke all on function private.search_query(text) from public, anon;
grant execute on function private.search_query(text) to authenticated, service_role;

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

  -- The query is data: reduced to letter/digit tokens, never concatenated into SQL.
  v_query := private.search_query(p_query);

  select coalesce(jsonb_agg(to_jsonb(ranked) order by ranked.rank desc, ranked.chunk_id), '[]'::jsonb) into v_results
  from (
    select c.id as chunk_id, c.source_kind, c.source_id, c.subject_id, c.document_version_id, c.page, c.citation, c.content,
           ts_rank_cd(c.search, v_query, 1) as rank
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
