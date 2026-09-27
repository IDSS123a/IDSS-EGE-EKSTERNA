import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CanonVersionStatus } from "@/features/canon/types";
import { RegistryFunctionError } from "@/features/canon/repository";
import type { IngestionCounts, IngestionReport } from "./domain/report";
import type { CatalogueRecord } from "./types";

/**
 * Database access for ingestion (A-3). Reads of jobs use the user-scoped client (RLS); the single
 * write path is `record_ingestion_job` (migration 007) with the service-role client, called only
 * after the action has authorised the caller.
 */

export type VersionForIngestion = {
  id: string;
  status: CanonVersionStatus;
  sha256: string;
  storagePath: string;
  officialTitle: string;
  issuingAuthority: string;
};

/** Latest job of a version as shown on the registry screen. */
export type IngestionJobSummary = {
  id: string;
  versionId: string;
  state: "succeeded" | "failed";
  profileCode: string | null;
  extractorVersion: string;
  counts: Partial<IngestionCounts>;
  report: Partial<IngestionReport>;
  failureCode: string | null;
  finishedAt: string;
};

/** The version to ingest (service role; caller already authorised), or null. */
export async function findVersionForIngestion(admin: SupabaseClient, versionId: string): Promise<VersionForIngestion | null> {
  const { data, error } = await admin
    .from("canonical_document_versions")
    .select("id, status, sha256, storage_path, official_title, issuing_authority")
    .eq("id", versionId)
    .maybeSingle<{ id: string; status: CanonVersionStatus; sha256: string; storage_path: string; official_title: string; issuing_authority: string }>();
  if (error) throw new Error(`findVersionForIngestion failed: ${error.message}`);
  return data ? { id: data.id, status: data.status, sha256: data.sha256, storagePath: data.storage_path, officialTitle: data.official_title, issuingAuthority: data.issuing_authority } : null;
}

/**
 * record_ingestion_job (migration 007): job, records, dependency map and audit row in one transaction.
 * @throws RegistryFunctionError with the database's machine message
 */
export async function recordIngestionJob(
  admin: SupabaseClient,
  input: {
    actorUserId: string;
    versionId: string;
    job: { state: "succeeded" | "failed"; profile_code: string | null; profile_version: number | null; extractor_version: string; page_count: number | null; counts: object; report: object; failure_code: string | null; started_at: string };
    records: CatalogueRecord[];
    ipAddress: string | null;
  },
): Promise<string> {
  const { data, error } = await admin.rpc("record_ingestion_job", {
    p_actor: input.actorUserId,
    p_version_id: input.versionId,
    p_job: input.job,
    p_records: input.records.map((record) => ({ record_key: record.id, record_kind: record.record_kind, structural_status: record.validation.structural_status, record })),
    p_ip: input.ipAddress,
  });
  if (error) throw new RegistryFunctionError(error.message);
  return data as string;
}

/** Latest ingestion job per version the caller may see (user-scoped client, RLS). */
export async function latestJobs(client: SupabaseClient, versionIds: string[]): Promise<Map<string, IngestionJobSummary>> {
  const jobs = new Map<string, IngestionJobSummary>();
  if (versionIds.length === 0) return jobs;
  const { data, error } = await client
    .from("canonical_ingestion_jobs")
    .select("id, version_id, state, profile_code, extractor_version, counts, report, failure_code, finished_at")
    .in("version_id", versionIds)
    .order("finished_at", { ascending: false })
    .limit(versionIds.length * 20);
  if (error) throw new Error(`latestJobs failed: ${error.message}`);
  for (const row of (data ?? []) as { id: string; version_id: string; state: "succeeded" | "failed"; profile_code: string | null; extractor_version: string; counts: Partial<IngestionCounts>; report: Partial<IngestionReport>; failure_code: string | null; finished_at: string }[]) {
    if (jobs.has(row.version_id)) continue;
    jobs.set(row.version_id, { id: row.id, versionId: row.version_id, state: row.state, profileCode: row.profile_code, extractorVersion: row.extractor_version, counts: row.counts, report: row.report, failureCode: row.failure_code, finishedAt: row.finished_at });
  }
  return jobs;
}
