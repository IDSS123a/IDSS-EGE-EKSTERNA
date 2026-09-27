import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RegistryFunctionError } from "@/features/canon/repository";
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
};

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
      return ((data ?? []) as ChunkRow[]).map((row) => ({
        chunkId: row.chunk_id,
        sourceKind: row.source_kind,
        sourceId: row.source_id,
        subjectId: row.subject_id,
        documentVersionId: row.document_version_id,
        page: row.page,
        citation: row.citation,
        content: row.content,
        rank: row.rank,
      }));
    },
  };
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
