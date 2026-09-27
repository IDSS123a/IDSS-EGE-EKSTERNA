"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { CANON_PATH } from "@/constants";
import { auditIfFailed, formId } from "@/features/audit/failures";
import { clientIpFrom } from "@/features/authentication/domain";
import { getCurrentAccount } from "@/features/authentication/session";
import { sha256Hex } from "@/features/canon/domain";
import { RegistryFunctionError, downloadObject } from "@/features/canon/repository";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { logError, logInfo } from "@/lib/logger";
import { canPublishCanon } from "@/lib/permissions";
import { IngestionRunSchema } from "@/lib/validation/schemas";
import { EXTRACTOR_VERSION } from "./domain/common";
import { ingestionErrorFromDatabase } from "./domain/errors";
import { extractCatalogue } from "./domain/extract";
import { profileForSha256 } from "./domain/profiles";
import { buildReport, countRecords } from "./domain/report";
import { findVersionForIngestion, recordIngestionJob } from "./repository";
import type { IngestionActionResult, IngestionErrorCode } from "./types";
import { RECORDED_FAILURES } from "./types";

type RecordedFailure = (typeof RECORDED_FAILURES)[number];

/**
 * POST (Server Action) runIngestionAction
 * Role required: canon.publish.
 * Body: FormData { versionId } of an active version or one awaiting validation.
 * Reads the stored source, checks its SHA-256 against the registry, picks the reviewed parser
 * profile for that exact edition, extracts every catalogue record (all untrusted) and stores the
 * job, its records and the report in one transaction (record_ingestion_job, migration 007).
 * A run that cannot extract (no profile, changed file, no text layer) is stored as a failed job.
 * Errors: UNAUTHENTICATED, FORBIDDEN, VALIDATION, NOT_FOUND, INVALID_TRANSITION, NO_PROFILE,
 *   INTEGRITY, SOURCE_MISSING, UNREADABLE_PDF, NO_TEXT_LAYER, UNAVAILABLE.
 */
export async function runIngestionAction(_previous: IngestionActionResult | null, formData: FormData): Promise<IngestionActionResult> {
  const result = await runIngestion(formData);
  return auditIfFailed(result, { action: "canon.ingestion_run", entityType: "canonical_document_version", entityId: formId(formData, "versionId") });
}

async function runIngestion(formData: FormData): Promise<IngestionActionResult> {
  const actor = await getCurrentAccount();
  if (!actor) return { success: false, code: "UNAUTHENTICATED" };
  if (!canPublishCanon(actor)) return { success: false, code: "FORBIDDEN" };
  const parsed = IngestionRunSchema.safeParse({ versionId: formData.get("versionId") });
  if (!parsed.success) return { success: false, code: "VALIDATION" };
  const startedAt = new Date().toISOString();
  const ipAddress = clientIpFrom((await headers()).get("x-forwarded-for"));

  try {
    const admin = createSupabaseAdminClient();
    const version = await findVersionForIngestion(admin, parsed.data.versionId);
    if (!version) return { success: false, code: "NOT_FOUND" };
    if (version.status !== "active" && version.status !== "validation_required") return { success: false, code: "INVALID_TRANSITION" };

    const fail = async (code: RecordedFailure, profile: { code: string; version: number } | null, pageCount: number | null): Promise<IngestionActionResult> => {
      await recordIngestionJob(admin, {
        actorUserId: actor.userId,
        versionId: version.id,
        job: { state: "failed", profile_code: profile?.code ?? null, profile_version: profile?.version ?? null, extractor_version: EXTRACTOR_VERSION, page_count: pageCount, counts: {}, report: {}, failure_code: code, started_at: startedAt },
        records: [],
        ipAddress,
      });
      revalidatePath(CANON_PATH);
      return { success: false, code };
    };

    const profile = profileForSha256(version.sha256);
    if (!profile) return fail("NO_PROFILE", null, null);
    const profileRef = { code: profile.code, version: profile.version };
    const bytes = await downloadObject(admin, version.storagePath);
    if (!bytes) return fail("SOURCE_MISSING", profileRef, null);
    // The stored file must still be exactly the registered one.
    if ((await sha256Hex(bytes)) !== version.sha256) return fail("INTEGRITY", profileRef, null);

    let extraction: Awaited<ReturnType<typeof extractCatalogue>>;
    try {
      extraction = await extractCatalogue(
        bytes,
        { file: version.storagePath, sha256: version.sha256, official_title: version.officialTitle, issuing_authority: version.issuingAuthority, version_id: version.id },
        profile,
        startedAt,
      );
    } catch (error) {
      logError("ingestion/actions.runIngestionAction.extract", error, { versionId: version.id });
      return fail("UNREADABLE_PDF", profileRef, null);
    }
    if (extraction.textLayerEmpty) return fail("NO_TEXT_LAYER", profileRef, extraction.pageCount);

    const counts = countRecords(extraction.records);
    await recordIngestionJob(admin, {
      actorUserId: actor.userId,
      versionId: version.id,
      job: {
        state: "succeeded",
        profile_code: profile.code,
        profile_version: profile.version,
        extractor_version: EXTRACTOR_VERSION,
        page_count: extraction.pageCount,
        counts,
        report: buildReport(extraction.records, extraction.stats),
        failure_code: null,
        started_at: startedAt,
      },
      records: extraction.records,
      ipAddress,
    });
    logInfo("ingestion/actions.runIngestionAction", "catalogue ingested", { profile: profile.code, units: counts.units });
    revalidatePath(CANON_PATH);
    return { success: true, data: { message: "INGESTED", units: counts.units, scoredUnits: counts.scored_units } };
  } catch (error) {
    const code: IngestionErrorCode = error instanceof RegistryFunctionError ? ingestionErrorFromDatabase(error.databaseMessage) : "UNAVAILABLE";
    if (code === "UNAVAILABLE") logError("ingestion/actions.runIngestionAction", error);
    return { success: false, code };
  }
}
