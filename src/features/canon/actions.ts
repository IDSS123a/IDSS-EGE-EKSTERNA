"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { CANON_PATH } from "@/constants";
import { auditIfFailed, formId } from "@/features/audit/failures";
import { clientIpFrom } from "@/features/authentication/domain";
import { getCurrentAccount } from "@/features/authentication/session";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { logError, logInfo } from "@/lib/logger";
import { canPublishCanon } from "@/lib/permissions";
import { CanonRegisterSchema, CanonTransitionSchema, CanonUploadRequestSchema } from "@/lib/validation/schemas";
import { availableActions, canonErrorFromDatabase, hasPdfSignature, isAcceptableSize, requiresReason, sha256Hex, sourcePath, stagingPath } from "./domain";
import {
  RegistryFunctionError,
  createStagingUploadUrl,
  downloadObject,
  findVersionStatus,
  registerVersion,
  removeObjects,
  sha256Registered,
  storeSource,
  transitionVersion,
} from "./repository";
import type { CanonActionResult, CanonErrorCode, CanonUploadTicket } from "./types";

/**
 * Canon registry Server Actions (Sprint 02). Each follows E-6:
 * authenticate → authorise (lib/permissions.ts) → validate (Zod) → execute → standard result.
 * The registry functions of migration 006 re-check the capability and the transition in the
 * database and write the history event and the audit row in the same transaction.
 * Failed attempts are audited too (auditIfFailed).
 *
 * Upload is two steps because a PDF can be larger than a request body allows:
 * 1. prepareCanonUploadAction issues a single-use signed URL for a staging object;
 *    the browser uploads the file there directly.
 * 2. registerCanonVersionAction reads the staging object ON THE SERVER, verifies it (PDF
 *    signature, size, SHA-256, duplicate), stores it under its content hash and registers it.
 *    Nothing the browser says about the file is trusted.
 */

async function requestIp(): Promise<string | null> {
  return clientIpFrom((await headers()).get("x-forwarded-for"));
}

/**
 * POST (Server Action) prepareCanonUploadAction
 * Role required: canon.publish.
 * Body: { byteSize } (declared size, checked again after upload).
 * Response: { success: true, data: { uploadId, uploadUrl } } or { success: false, code }.
 * Errors: UNAUTHENTICATED, FORBIDDEN, VALIDATION, TOO_LARGE, UNAVAILABLE.
 */
export async function prepareCanonUploadAction(request: { byteSize: number }): Promise<CanonUploadTicket> {
  const result = await prepareUpload(request);
  return auditIfFailed(result, { action: "canon.upload_prepare", entityType: "canonical_document_version" });
}

async function prepareUpload(request: { byteSize: number }): Promise<CanonUploadTicket> {
  const actor = await getCurrentAccount();
  if (!actor) return { success: false, code: "UNAUTHENTICATED" };
  if (!canPublishCanon(actor)) return { success: false, code: "FORBIDDEN" };
  const parsed = CanonUploadRequestSchema.safeParse(request);
  if (!parsed.success) return { success: false, code: "VALIDATION" };
  if (!isAcceptableSize(parsed.data.byteSize)) return { success: false, code: "TOO_LARGE" };

  try {
    const uploadId = crypto.randomUUID();
    const uploadUrl = await createStagingUploadUrl(createSupabaseAdminClient(), stagingPath(uploadId));
    return { success: true, data: { uploadId, uploadUrl } };
  } catch (error) {
    logError("canon/actions.prepareCanonUploadAction", error);
    return { success: false, code: "UNAVAILABLE" };
  }
}

/**
 * POST (Server Action) registerCanonVersionAction
 * Role required: canon.publish.
 * Body: FormData { uploadId, documentId | (typeCode, documentTitle), subjectLabel?, issuingAuthority,
 *   officialTitle, referenceNumber?, publishedOn?, effectiveFrom?, revisionLabel? }.
 * The new version is in state validation_required until activated.
 * Errors: UNAUTHENTICATED, FORBIDDEN, VALIDATION, UPLOAD_MISSING, NOT_PDF, TOO_LARGE, DUPLICATE_FILE, NOT_FOUND, UNAVAILABLE.
 */
export async function registerCanonVersionAction(_previous: CanonActionResult | null, formData: FormData): Promise<CanonActionResult> {
  const result = await registerUpload(formData);
  return auditIfFailed(result, { action: "canon.version_upload", entityType: "canonical_document", entityId: formId(formData, "documentId") });
}

async function registerUpload(formData: FormData): Promise<CanonActionResult> {
  const actor = await getCurrentAccount();
  if (!actor) return { success: false, code: "UNAUTHENTICATED" };
  if (!canPublishCanon(actor)) return { success: false, code: "FORBIDDEN" };
  const field = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value : undefined;
  };
  const parsed = CanonRegisterSchema.safeParse({
    uploadId: field("uploadId"),
    documentId: field("documentId"),
    typeCode: field("typeCode"),
    documentTitle: field("documentTitle"),
    subjectLabel: field("subjectLabel"),
    issuingAuthority: field("issuingAuthority"),
    officialTitle: field("officialTitle"),
    referenceNumber: field("referenceNumber"),
    publishedOn: field("publishedOn"),
    effectiveFrom: field("effectiveFrom"),
    revisionLabel: field("revisionLabel"),
  });
  if (!parsed.success) return { success: false, code: "VALIDATION" };
  const input = parsed.data;

  let admin: ReturnType<typeof createSupabaseAdminClient> | null = null;
  const staging = stagingPath(input.uploadId);
  let storedSource: string | null = null;
  let code: CanonErrorCode | null = null;
  try {
    admin = createSupabaseAdminClient();
    const bytes = await downloadObject(admin, staging);
    if (!bytes) return { success: false, code: "UPLOAD_MISSING" };
    if (!isAcceptableSize(bytes.byteLength)) code = "TOO_LARGE";
    else if (!hasPdfSignature(bytes)) code = "NOT_PDF";
    if (code) return { success: false, code };

    const sha256 = await sha256Hex(bytes);
    if (await sha256Registered(admin, sha256)) {
      code = "DUPLICATE_FILE";
      return { success: false, code };
    }
    const path = sourcePath(sha256);
    await storeSource(admin, path, bytes);
    storedSource = path;
    await registerVersion(admin, {
      actorUserId: actor.userId,
      documentId: input.documentId,
      typeCode: input.documentId ? null : (input.typeCode ?? null),
      documentTitle: input.documentId ? null : input.documentTitle,
      subjectLabel: input.documentId ? null : input.subjectLabel,
      versionId: crypto.randomUUID(),
      storagePath: path,
      sha256,
      byteSize: bytes.byteLength,
      issuingAuthority: input.issuingAuthority,
      officialTitle: input.officialTitle,
      referenceNumber: input.referenceNumber,
      publishedOn: input.publishedOn,
      effectiveFrom: input.effectiveFrom,
      revisionLabel: input.revisionLabel,
      ipAddress: await requestIp(),
    });
    storedSource = null;
    logInfo("canon/actions.registerCanonVersionAction", "canon version registered", { sha256 });
  } catch (error) {
    code = error instanceof RegistryFunctionError ? canonErrorFromDatabase(error.databaseMessage) : "UNAVAILABLE";
    if (code === "UNAVAILABLE") logError("canon/actions.registerCanonVersionAction", error);
    return { success: false, code };
  } finally {
    // The staging object is never kept; a stored source without a registered version is removed.
    if (admin) {
      const leftovers = storedSource ? [staging, storedSource] : [staging];
      const cleanupError = await removeObjects(admin, leftovers);
      if (cleanupError) logError("canon/actions.registerCanonVersionAction.cleanup", new Error(cleanupError), { paths: leftovers.join(",") });
    }
  }
  revalidatePath(CANON_PATH);
  return { success: true, data: { message: "REGISTERED" } };
}

/**
 * POST (Server Action) transitionCanonVersionAction
 * Role required: canon.publish.
 * Body: FormData { versionId, action: activate|rollback|reject|archive, reason? }.
 * activate: validation_required → active (the active version of the document becomes superseded).
 * rollback: superseded → active, reason required. reject: validation_required → rejected, reason
 * required. archive: superseded → archived, reason required. Nothing is ever deleted.
 * Errors: UNAUTHENTICATED, FORBIDDEN, VALIDATION, REASON_REQUIRED, NOT_FOUND, INVALID_TRANSITION, UNAVAILABLE.
 */
export async function transitionCanonVersionAction(_previous: CanonActionResult | null, formData: FormData): Promise<CanonActionResult> {
  const result = await transition(formData);
  return auditIfFailed(result, { action: "canon.version_transition", entityType: "canonical_document_version", entityId: formId(formData, "versionId") });
}

async function transition(formData: FormData): Promise<CanonActionResult> {
  const actor = await getCurrentAccount();
  if (!actor) return { success: false, code: "UNAUTHENTICATED" };
  if (!canPublishCanon(actor)) return { success: false, code: "FORBIDDEN" };
  const parsed = CanonTransitionSchema.safeParse({
    versionId: formData.get("versionId"),
    action: formData.get("action"),
    reason: formData.get("reason") ?? undefined,
  });
  if (!parsed.success) return { success: false, code: "VALIDATION" };
  const { versionId, action, reason } = parsed.data;
  if (requiresReason(action) && !reason) return { success: false, code: "REASON_REQUIRED" };

  try {
    const admin = createSupabaseAdminClient();
    const status = await findVersionStatus(admin, versionId);
    if (!status) return { success: false, code: "NOT_FOUND" };
    if (!availableActions(status).includes(action)) return { success: false, code: "INVALID_TRANSITION" };
    await transitionVersion(admin, { actorUserId: actor.userId, versionId, action, reason, ipAddress: await requestIp() });
    logInfo("canon/actions.transitionCanonVersionAction", "canon version changed", { action });
  } catch (error) {
    const code = error instanceof RegistryFunctionError ? canonErrorFromDatabase(error.databaseMessage) : "UNAVAILABLE";
    if (code === "UNAVAILABLE") logError("canon/actions.transitionCanonVersionAction", error);
    return { success: false, code };
  }
  revalidatePath(CANON_PATH);
  const messages = { activate: "ACTIVATED", rollback: "ROLLED_BACK", reject: "REJECTED", archive: "ARCHIVED" } as const;
  return { success: true, data: { message: messages[action] } };
}
