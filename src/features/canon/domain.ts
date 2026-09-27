import { CANON_MAX_BYTES, CANON_SOURCES_PREFIX, CANON_STAGING_PREFIX } from "@/constants";
import type { CanonAction, CanonErrorCode, CanonVersionStatus } from "./types";

/**
 * Canon registry rules (framework-free, unit-tested). The database enforces the same
 * transitions again (migration 006); these rules decide what the UI offers and what the
 * server accepts before it touches storage.
 */

/** Every PDF file starts with these bytes ("%PDF-"), whatever its name or declared type. */
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d];

/** True when the bytes start with the PDF signature. */
export function hasPdfSignature(bytes: Uint8Array): boolean {
  return bytes.length >= PDF_MAGIC.length && PDF_MAGIC.every((byte, index) => bytes[index] === byte);
}

/** Size check shared by the prepare and register steps. */
export function isAcceptableSize(byteSize: number): boolean {
  return Number.isInteger(byteSize) && byteSize > 0 && byteSize <= CANON_MAX_BYTES;
}

/** Lower-case hexadecimal SHA-256 of the file content (Web Crypto; server and tests). */
export async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Staging object of one upload attempt (bucket-relative). */
export function stagingPath(uploadId: string): string {
  return `${CANON_STAGING_PREFIX}${uploadId}.pdf`;
}

/** Final, content-addressed object of a verified source file (bucket-relative). */
export function sourcePath(sha256: string): string {
  return `${CANON_SOURCES_PREFIX}${sha256}.pdf`;
}

/** Lifecycle actions available for a version in a given state (mirrors migration 006). */
export function availableActions(status: CanonVersionStatus): CanonAction[] {
  switch (status) {
    case "validation_required":
      return ["activate", "reject"];
    case "superseded":
      return ["rollback", "archive"];
    default:
      return [];
  }
}

/** Actions that must carry a reason (history and audit). */
export function requiresReason(action: CanonAction): boolean {
  return action !== "activate";
}

const DATABASE_ERRORS: Record<string, CanonErrorCode> = {
  FORBIDDEN: "FORBIDDEN",
  DUPLICATE_FILE: "DUPLICATE_FILE",
  NOT_FOUND: "NOT_FOUND",
  INVALID_TRANSITION: "INVALID_TRANSITION",
  REASON_REQUIRED: "REASON_REQUIRED",
};

/** Map an error raised by a registry function to an action code; anything else is UNAVAILABLE. */
export function canonErrorFromDatabase(message: string | undefined): CanonErrorCode {
  return (message && DATABASE_ERRORS[message.trim()]) || "UNAVAILABLE";
}

/** Short, readable form of a SHA-256 for screens (the full value stays in the data). */
export function shortHash(sha256: string): string {
  return sha256.slice(0, 12);
}
