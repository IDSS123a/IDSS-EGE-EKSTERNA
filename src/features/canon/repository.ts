import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CANON_BUCKET, CANON_DOCUMENT_LIST_LIMIT, CANON_MIME_TYPE } from "@/constants";
import type { CanonAction, CanonDocument, CanonDocumentType, CanonEvent, CanonRegistry, CanonVersion, CanonVersionStatus } from "./types";

/**
 * Database and storage access for the canon registry (A-3). No business rules here.
 * Reads use the user-scoped client (RLS decides visibility). Writes go only through the
 * registry functions of migration 006 with the service-role client, and are only called
 * after the action has authorised the caller.
 */

type TypeRow = { code: string; name: string; authority_level: number; capabilities: Record<string, boolean> };
type DocumentRow = { id: string; title: string; type_code: string; scope: { subject_label?: string } | null; created_at: string };
type VersionRow = {
  id: string;
  document_id: string;
  status: CanonVersionStatus;
  official_title: string;
  issuing_authority: string;
  reference_number: string | null;
  published_on: string | null;
  effective_from: string | null;
  revision_label: string | null;
  sha256: string;
  byte_size: number;
  uploaded_at: string;
  activated_at: string | null;
};
type EventRow = {
  id: number;
  version_id: string;
  document_id: string;
  event: CanonEvent;
  actor_user_id: string;
  reason: string | null;
  generation: number | null;
  occurred_at: string;
};
type DependencyRow = { source_version_id: string; state: "current" | "stale" | "rebuilt" };

/** Error raised by a registry function, carrying its machine message (e.g. INVALID_TRANSITION). */
export class RegistryFunctionError extends Error {
  constructor(readonly databaseMessage: string) {
    super(`registry function failed: ${databaseMessage}`);
    this.name = "RegistryFunctionError";
  }
}

function fail(context: string, error: { message: string }): never {
  throw new Error(`${context} failed: ${error.message}`);
}

/**
 * The registry as visible to the caller: document types, documents (newest first, bounded),
 * all their versions, history and dependency counts, and the current canon generation.
 * @param actorNames resolves history actor ids to display names (staff names only)
 */
export async function loadRegistry(client: SupabaseClient, actorNames: (ids: string[]) => Promise<Map<string, string>>): Promise<CanonRegistry> {
  const types = await client.from("canonical_document_types").select("code, name, authority_level, capabilities").order("authority_level").returns<TypeRow[]>();
  if (types.error) fail("loadRegistry(types)", types.error);
  const documents = await client
    .from("canonical_documents")
    .select("id, title, type_code, scope, created_at")
    .order("created_at", { ascending: false })
    .limit(CANON_DOCUMENT_LIST_LIMIT)
    .returns<DocumentRow[]>();
  if (documents.error) fail("loadRegistry(documents)", documents.error);
  const generation = await client.from("canon_generation").select("generation").maybeSingle<{ generation: number }>();
  if (generation.error) fail("loadRegistry(generation)", generation.error);

  const documentIds = (documents.data ?? []).map((row) => row.id);
  let versions: VersionRow[] = [];
  let events: EventRow[] = [];
  let dependencies: DependencyRow[] = [];
  if (documentIds.length > 0) {
    const versionResult = await client
      .from("canonical_document_versions")
      .select("id, document_id, status, official_title, issuing_authority, reference_number, published_on, effective_from, revision_label, sha256, byte_size, uploaded_at, activated_at")
      .in("document_id", documentIds)
      .order("uploaded_at", { ascending: false })
      .returns<VersionRow[]>();
    if (versionResult.error) fail("loadRegistry(versions)", versionResult.error);
    versions = versionResult.data ?? [];

    const eventResult = await client
      .from("canonical_version_events")
      .select("id, version_id, document_id, event, actor_user_id, reason, generation, occurred_at")
      .in("document_id", documentIds)
      .order("occurred_at", { ascending: false })
      .limit(CANON_DOCUMENT_LIST_LIMIT * 20)
      .returns<EventRow[]>();
    if (eventResult.error) fail("loadRegistry(history)", eventResult.error);
    events = eventResult.data ?? [];

    const versionIds = versions.map((row) => row.id);
    if (versionIds.length > 0) {
      const dependencyResult = await client
        .from("canonical_dependencies")
        .select("source_version_id, state")
        .in("source_version_id", versionIds)
        .returns<DependencyRow[]>();
      if (dependencyResult.error) fail("loadRegistry(dependencies)", dependencyResult.error);
      dependencies = dependencyResult.data ?? [];
    }
  }

  const names = await actorNames([...new Set(events.map((row) => row.actor_user_id))]);
  const dependentsOf = (versionId: string) => ({
    current: dependencies.filter((row) => row.source_version_id === versionId && row.state !== "stale").length,
    stale: dependencies.filter((row) => row.source_version_id === versionId && row.state === "stale").length,
  });

  return {
    generation: generation.data?.generation ?? 0,
    types: (types.data ?? []).map(
      (row): CanonDocumentType => ({
        code: row.code,
        name: row.name,
        authorityLevel: row.authority_level,
        derives: Object.entries(row.capabilities ?? {}).filter(([, enabled]) => enabled).map(([key]) => key),
      }),
    ),
    documents: (documents.data ?? []).map(
      (row): CanonDocument => ({
        id: row.id,
        title: row.title,
        typeCode: row.type_code,
        subjectLabel: row.scope?.subject_label ?? null,
        createdAt: row.created_at,
        versions: versions
          .filter((version) => version.document_id === row.id)
          .map(
            (version): CanonVersion => ({
              id: version.id,
              status: version.status,
              officialTitle: version.official_title,
              issuingAuthority: version.issuing_authority,
              referenceNumber: version.reference_number,
              publishedOn: version.published_on,
              effectiveFrom: version.effective_from,
              revisionLabel: version.revision_label,
              sha256: version.sha256,
              byteSize: version.byte_size,
              uploadedAt: version.uploaded_at,
              activatedAt: version.activated_at,
              dependents: dependentsOf(version.id),
            }),
          ),
        history: events
          .filter((event) => event.document_id === row.id)
          .map((event) => ({
            id: event.id,
            versionId: event.version_id,
            event: event.event,
            actorName: names.get(event.actor_user_id) ?? "",
            reason: event.reason,
            generation: event.generation,
            occurredAt: event.occurred_at,
          })),
      }),
    ),
  };
}

/** Display names of staff accounts that appear in the registry history (service role; caller already authorised). */
export async function findDisplayNames(admin: SupabaseClient, userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const { data, error } = await admin.from("profiles").select("user_id, display_name").in("user_id", userIds);
  if (error) fail("findDisplayNames", error);
  return new Map((data as { user_id: string; display_name: string }[]).map((row) => [row.user_id, row.display_name]));
}

/** Storage path of a version the caller may see (user-scoped client, RLS), or null. */
export async function findVersionForDownload(client: SupabaseClient, versionId: string): Promise<{ storagePath: string; sha256: string } | null> {
  const { data, error } = await client
    .from("canonical_document_versions")
    .select("storage_path, sha256")
    .eq("id", versionId)
    .maybeSingle<{ storage_path: string; sha256: string }>();
  if (error) fail("findVersionForDownload", error);
  return data ? { storagePath: data.storage_path, sha256: data.sha256 } : null;
}

// ------------------------------------------------------------------ storage (service role)

/** Single-use signed URL the browser uploads the file to (staging object). */
export async function createStagingUploadUrl(admin: SupabaseClient, path: string): Promise<string> {
  const { data, error } = await admin.storage.from(CANON_BUCKET).createSignedUploadUrl(path);
  if (error || !data) fail("createStagingUploadUrl", error ?? { message: "no url" });
  return data.signedUrl;
}

/** Content of an uploaded staging object, or null when nothing was uploaded under that path. */
export async function downloadObject(admin: SupabaseClient, path: string): Promise<Uint8Array<ArrayBuffer> | null> {
  const { data, error } = await admin.storage.from(CANON_BUCKET).download(path);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}

/** Store verified bytes under their content-addressed path (never overwrites). */
export async function storeSource(admin: SupabaseClient, path: string, bytes: Uint8Array): Promise<void> {
  const { error } = await admin.storage.from(CANON_BUCKET).upload(path, bytes, { contentType: CANON_MIME_TYPE, upsert: false });
  if (error) fail("storeSource", error);
}

/** Remove objects (staging clean-up, or a source whose registration failed). Failures are reported, not thrown. */
export async function removeObjects(admin: SupabaseClient, paths: string[]): Promise<string | null> {
  const { error } = await admin.storage.from(CANON_BUCKET).remove(paths);
  return error ? error.message : null;
}

/** Short-lived signed download URL for a source file. */
export async function createDownloadUrl(admin: SupabaseClient, path: string, ttlSeconds: number, fileName: string): Promise<string> {
  const { data, error } = await admin.storage.from(CANON_BUCKET).createSignedUrl(path, ttlSeconds, { download: fileName });
  if (error || !data) fail("createDownloadUrl", error ?? { message: "no url" });
  return data.signedUrl;
}

// ------------------------------------------------------------------ registry functions (service role)

/** register_canon_version (migration 006). @throws RegistryFunctionError with the database's machine message */
export async function registerVersion(
  admin: SupabaseClient,
  input: {
    actorUserId: string;
    documentId: string | null;
    typeCode: string | null;
    documentTitle: string | null;
    subjectLabel: string | null;
    versionId: string;
    storagePath: string;
    sha256: string;
    byteSize: number;
    issuingAuthority: string;
    officialTitle: string;
    referenceNumber: string | null;
    publishedOn: string | null;
    effectiveFrom: string | null;
    revisionLabel: string | null;
    ipAddress: string | null;
  },
): Promise<{ documentId: string; versionId: string }> {
  const { data, error } = await admin.rpc("register_canon_version", {
    p_actor: input.actorUserId,
    p_document_id: input.documentId,
    p_type_code: input.typeCode,
    p_document_title: input.documentTitle,
    p_scope: input.subjectLabel ? { subject_label: input.subjectLabel } : {},
    p_version_id: input.versionId,
    p_storage_path: input.storagePath,
    p_sha256: input.sha256,
    p_mime_type: CANON_MIME_TYPE,
    p_byte_size: input.byteSize,
    p_issuing_authority: input.issuingAuthority,
    p_official_title: input.officialTitle,
    p_reference_number: input.referenceNumber,
    p_published_on: input.publishedOn,
    p_effective_from: input.effectiveFrom,
    p_revision_label: input.revisionLabel,
    p_ip: input.ipAddress,
  });
  if (error) throw new RegistryFunctionError(error.message);
  const result = data as { document_id: string; version_id: string };
  return { documentId: result.document_id, versionId: result.version_id };
}

/** True when a version with this content hash is already registered (service role). */
export async function sha256Registered(admin: SupabaseClient, sha256: string): Promise<boolean> {
  const { count, error } = await admin.from("canonical_document_versions").select("id", { count: "exact", head: true }).eq("sha256", sha256);
  if (error) fail("sha256Registered", error);
  return (count ?? 0) > 0;
}

/**
 * Lifecycle change through activate_canon_version / set_canon_version_status (migration 006).
 * @throws RegistryFunctionError with the database's machine message
 */
export async function transitionVersion(
  admin: SupabaseClient,
  input: { actorUserId: string; versionId: string; action: CanonAction; reason: string | null; ipAddress: string | null },
): Promise<void> {
  const common = { p_actor: input.actorUserId, p_version_id: input.versionId, p_reason: input.reason, p_ip: input.ipAddress };
  const { error } =
    input.action === "activate" || input.action === "rollback"
      ? await admin.rpc("activate_canon_version", common)
      : await admin.rpc("set_canon_version_status", { ...common, p_status: input.action === "reject" ? "rejected" : "archived" });
  if (error) throw new RegistryFunctionError(error.message);
}

/** Current status of a version (service role; caller already authorised), or null. */
export async function findVersionStatus(admin: SupabaseClient, versionId: string): Promise<CanonVersionStatus | null> {
  const { data, error } = await admin.from("canonical_document_versions").select("status").eq("id", versionId).maybeSingle<{ status: CanonVersionStatus }>();
  if (error) fail("findVersionStatus", error);
  return data?.status ?? null;
}
