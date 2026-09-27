import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RegistryFunctionError } from "@/features/canon/repository";
import type { Embedder } from "@/lib/ai/gemini-embeddings";
import type { CanonRetriever, RetrievalRequest, RetrievedChunk } from "./types";

/**
 * Database access for retrieval (A-3). Both functions of migrations 009 to 011 run with the service-role
 * client after the action has authorised the caller; the database re-checks the actor and the subject scope,
 * filters active versions before ranking and audits every retrieval.
 */

type ChunkRow = {
  chunk_id: string;
  source_kind: RetrievedChunk["sourceKind"];
  source_id: string;
  subject_id: string;
  document_version_id: string;
  page: number | null;
  citation: RetrievedChunk["citation"];
  content: string;
  rank: number;
  similarity?: number | null;
  keyword_rank?: number | null;
  similarity_z?: number | null;
};

function toChunk(row: ChunkRow): RetrievedChunk {
  const chunk: RetrievedChunk = {
    chunkId: row.chunk_id,
    sourceKind: row.source_kind,
    sourceId: row.source_id,
    subjectId: row.subject_id,
    documentVersionId: row.document_version_id,
    page: row.page,
    citation: row.citation,
    content: row.content,
    rank: row.rank,
  };
  if (row.similarity !== undefined || row.keyword_rank !== undefined) {
    chunk.similarity = row.similarity ?? null;
    chunk.keywordRank = row.keyword_rank ?? null;
    chunk.similarityZ = row.similarity_z ?? null;
  }
  return chunk;
}

/** Full-text retriever over trusted canon (retrieve_canon); the first CanonRetriever implementation. */
export function fullTextRetriever(admin: SupabaseClient): CanonRetriever {
  return {
    name: "postgres-full-text",
    async retrieve(request: RetrievalRequest): Promise<RetrievedChunk[]> {
      const { data, error } = await admin.rpc("retrieve_canon", {
        p_actor: request.actorUserId,
        p_query: request.query,
        p_subject_id: request.subjectId,
        p_k: request.k,
      });
      if (error) throw new RegistryFunctionError(error.message);
      return ((data ?? []) as ChunkRow[]).map(toChunk);
    },
  };
}

/**
 * Semantic retriever (PDL-023): the query is embedded by Gemini, then retrieve_canon_semantic scopes, ranks by
 * reciprocal rank fusion of vector similarity and full-text rank, and audits (migration 015).
 * @throws EmbeddingError when Gemini fails; RegistryFunctionError with the database's machine message
 */
export function semanticRetriever(admin: SupabaseClient, embedder: Embedder): CanonRetriever {
  return {
    name: `semantic-${embedder.model}`,
    async retrieve(request: RetrievalRequest): Promise<RetrievedChunk[]> {
      const vector = await embedder.embedQuery(request.query);
      const { data, error } = await admin.rpc("retrieve_canon_semantic", {
        p_actor: request.actorUserId,
        p_query: request.query,
        p_embedding: vector,
        p_model: embedder.model,
        p_subject_id: request.subjectId,
        p_k: request.k,
      });
      if (error) throw new RegistryFunctionError(error.message);
      return ((data ?? []) as ChunkRow[]).map(toChunk);
    },
  };
}

/** A chunk still without a vector for the model: exactly the text to embed and its hash. */
export type PendingChunk = { chunkId: string; title: string; content: string; contentSha256: string };

/**
 * pending_chunk_embeddings (migration 015): chunks of active versions without a vector for the model.
 * @throws RegistryFunctionError with the database's machine message
 */
export async function pendingEmbeddings(admin: SupabaseClient, actorUserId: string, model: string, limit: number): Promise<PendingChunk[]> {
  const { data, error } = await admin.rpc("pending_chunk_embeddings", { p_actor: actorUserId, p_model: model, p_limit: limit });
  if (error) throw new RegistryFunctionError(error.message);
  return ((data ?? []) as { chunk_id: string; title: string; content: string; content_sha256: string }[]).map((row) => ({
    chunkId: row.chunk_id,
    title: row.title,
    content: row.content,
    contentSha256: row.content_sha256,
  }));
}

/**
 * store_chunk_embeddings (migration 015): each vector is stored only for the exact text it was computed from; audited.
 * @throws RegistryFunctionError with the database's machine message
 */
export async function storeEmbeddings(admin: SupabaseClient, input: { actorUserId: string; model: string; rows: { chunkId: string; contentSha256: string; embedding: number[] }[]; ipAddress: string | null }): Promise<number> {
  const { data, error } = await admin.rpc("store_chunk_embeddings", {
    p_actor: input.actorUserId,
    p_model: input.model,
    p_rows: input.rows.map((row) => ({ chunk_id: row.chunkId, content_sha256: row.contentSha256, embedding: row.embedding })),
    p_ip: input.ipAddress,
  });
  if (error) throw new RegistryFunctionError(error.message);
  return data as number;
}

/** Number of chunks with a vector for the model, visible to the client's caller (RLS). */
export async function embeddingCount(client: SupabaseClient, model: string): Promise<number> {
  const { count, error } = await client.from("canonical_chunk_embeddings").select("chunk_id", { count: "exact", head: true }).eq("model", model);
  if (error) throw new Error(`embeddingCount failed: ${error.message}`);
  return count ?? 0;
}

/**
 * rebuild_canon_chunks: adds chunks for new trusted content; audited.
 * @throws RegistryFunctionError with the database's machine message
 */
export async function rebuildIndex(admin: SupabaseClient, actorUserId: string, ipAddress: string | null): Promise<{ questionChunksAdded: number; ruleChunksAdded: number; total: number }> {
  const { data, error } = await admin.rpc("rebuild_canon_chunks", { p_actor: actorUserId, p_ip: ipAddress });
  if (error) throw new RegistryFunctionError(error.message);
  const result = data as { question_chunks_added: number; rule_chunks_added: number; total: number };
  return { questionChunksAdded: result.question_chunks_added, ruleChunksAdded: result.rule_chunks_added, total: result.total };
}

/** Number of chunks per subject visible to the caller (user-scoped client, RLS). */
export async function chunkCounts(client: SupabaseClient): Promise<Map<string, number>> {
  const { data, error } = await client.from("canonical_chunks").select("subject_id").limit(10000);
  if (error) throw new Error(`chunkCounts failed: ${error.message}`);
  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { subject_id: string }[]) counts.set(row.subject_id, (counts.get(row.subject_id) ?? 0) + 1);
  return counts;
}
