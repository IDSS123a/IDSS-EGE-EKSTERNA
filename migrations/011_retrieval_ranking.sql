-- Migration: 011_retrieval_ranking
-- Date: 2026-09-27
-- Author: ACA (Claude Code)
-- Description: Sprint 05 ranking fix from the live check of 010 on the 514 real chunks: short function words
--   ("da", "li", "na", "iz") and ts_rank length normalisation ranked unrelated B/H/S texts above the rule a
--   question was about ("Da li smijem koristiti kalkulator?" did not find exam.forbidden_aids).
--   * private.search_terms(): folded words of 3+ letters (any digits), minus a short list of B/H/S and German
--     function words; words of 5+ letters match by prefix (all but the last two letters, at least 4).
--   * retrieve_canon(): ranks by coverage (how many distinct query terms a chunk contains) first, then ts_rank_cd;
--     the returned rank is coverage + ts_rank_cd, so the application's relevance floor counts matched terms.
--   * rebuild_canon_chunks(): rule chunks start with the subject's official name, so "ispit iz matematike" reaches
--     the Mathematics rules. Chunks are append-only; none exist live yet (the index was only built in rolled-back checks).
-- Rollback: re-apply 010 (search_query, retrieve_canon) and 009 (rebuild_canon_chunks); drop function if exists private.search_terms(text);

create or replace function private.search_terms(value text)
returns text[]
language sql immutable parallel safe set search_path = ''
as $$
  select coalesce(array_agg(distinct case when length(word) >= 5 and word !~ '^[0-9]+$' then left(word, greatest(4, length(word) - 2)) || ':*' else word end), '{}')
  from regexp_split_to_table(private.fold_text(value), '[^[:alnum:]]+') as words (word)
  where (length(word) >= 3 or word ~ '^[0-9]+$')
    and word <> all (array[
      -- B/H/S function words (folded)
      'ali', 'ako', 'bez', 'biti', 'ces', 'cu', 'dok', 'gdje', 'ili', 'ima', 'iza', 'jer', 'jos', 'kad', 'kada', 'kako', 'koja',
      'koje', 'koji', 'koju', 'kod', 'koliko', 'moj', 'moze', 'mogu', 'nad', 'nije', 'niti', 'oko', 'ona', 'oni', 'ono', 'pod',
      'pri', 'sam', 'smije', 'smijem', 'sta', 'sto', 'sve', 'svi', 'taj', 'tako', 'the', 'uz', 'vec', 'zasto', 'zbog',
      -- German function words (folded)
      'aber', 'als', 'auf', 'aus', 'bei', 'das', 'dass', 'dem', 'den', 'der', 'des', 'die', 'ein', 'eine', 'einen', 'einem',
      'einer', 'fur', 'hat', 'ich', 'ist', 'mit', 'nach', 'nicht', 'oder', 'sie', 'sind', 'und', 'von', 'was', 'wie', 'wir', 'zum', 'zur'])
$$;
revoke all on function private.search_terms(text) from public, anon;
grant execute on function private.search_terms(text) to authenticated, service_role;

create or replace function private.search_query(value text)
returns tsquery
language sql immutable parallel safe set search_path = ''
as $$
  select coalesce(to_tsquery('simple'::regconfig, array_to_string(private.search_terms(value), ' | ')), ''::tsquery)
$$;

create or replace function public.retrieve_canon(p_actor uuid, p_query text, p_subject_id uuid, p_k integer)
returns table (chunk_id uuid, source_kind text, source_id uuid, subject_id uuid, document_version_id uuid,
               page integer, citation jsonb, content text, rank real)
language plpgsql security invoker set search_path = ''
as $$
declare
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
  if p_query is null or length(btrim(p_query)) not between 2 and 500 or p_k is null or p_k not between 1 and 10 then
    raise exception 'VALIDATION' using errcode = '22023';
  end if;

  -- The query is data: reduced to letter/digit tokens, never concatenated into SQL.
  select coalesce(array_agg(to_tsquery('simple'::regconfig, term)), '{}') into v_terms from unnest(private.search_terms(p_query)) as terms (term);
  v_query := private.search_query(p_query);

  select coalesce(jsonb_agg(to_jsonb(ranked) order by ranked.rank desc, ranked.chunk_id), '[]'::jsonb) into v_results
  from (
    select c.id as chunk_id, c.source_kind, c.source_id, c.subject_id, c.document_version_id, c.page, c.citation, c.content,
           ((select count(*) from unnest(v_terms) as term where c.search @@ term) + ts_rank_cd(c.search, v_query))::real as rank
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

-- Rule chunks carry the subject's official name.
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
           concat_ws(E'\n', sub.official_name,
             (select string_agg(e ->> 'quote', E'\n' order by ordinality) from jsonb_array_elements(r.evidence) with ordinality as ev (e, ordinality))),
           p_actor
    from public.canonical_rules r
    join confirmed c on c.rule_id = r.id and c.decision = 'confirmed'
    join public.canonical_document_versions v on v.id = r.source_version_id and v.status = 'active'
    join public.subjects sub on sub.id = r.subject_id
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
