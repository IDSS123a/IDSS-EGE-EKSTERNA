import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CANON_MAX_BYTES } from "@/constants";
import {
  availableActions,
  canonErrorFromDatabase,
  hasPdfSignature,
  isAcceptableSize,
  requiresReason,
  sha256Hex,
  shortHash,
  sourcePath,
  stagingPath,
} from "@/features/canon/domain";
import { buildContentSecurityPolicy, canonUploadPrefix } from "@/features/security/csp";
import { CanonRegisterSchema, CanonTransitionSchema } from "@/lib/validation/schemas";
import manifest from "../../tools/canon-seed/catalogues.json";

const bytes = (text: string) => new TextEncoder().encode(text);
const UPLOAD_ID = "0b6f7f1e-3c1a-4d8e-9f00-1234567890ab";
const DOCUMENT_ID = "4c2d1a9e-7b6f-4e3d-8c2b-abcdefabcdef";

describe("canon upload checks", () => {
  it("accepts only the PDF signature, whatever the file is called", () => {
    expect(hasPdfSignature(bytes("%PDF-1.7\n..."))).toBe(true);
    expect(hasPdfSignature(bytes("PK\u0003\u0004 renamed.pdf"))).toBe(false);
    expect(hasPdfSignature(bytes("%PDF"))).toBe(false);
    expect(hasPdfSignature(new Uint8Array())).toBe(false);
  });

  it("enforces the size limit at the boundary", () => {
    expect(isAcceptableSize(1)).toBe(true);
    expect(isAcceptableSize(CANON_MAX_BYTES)).toBe(true);
    expect(isAcceptableSize(CANON_MAX_BYTES + 1)).toBe(false);
    expect(isAcceptableSize(0)).toBe(false);
    expect(isAcceptableSize(1.5)).toBe(false);
  });

  it("hashes with SHA-256 (known vector) and stores content-addressed", async () => {
    expect(await sha256Hex(bytes("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(sourcePath("ab".repeat(32))).toBe(`sources/${"ab".repeat(32)}.pdf`);
    expect(stagingPath(UPLOAD_ID)).toBe(`staging/${UPLOAD_ID}.pdf`);
    expect(shortHash("ba7816bf8f01cfea414140de")).toBe("ba7816bf8f01");
  });
});

describe("canon lifecycle rules (mirror migration 006)", () => {
  it("offers only the allowed transitions", () => {
    expect(availableActions("validation_required")).toEqual(["activate", "reject"]);
    expect(availableActions("superseded")).toEqual(["rollback", "archive"]);
    for (const status of ["active", "archived", "rejected", "draft", "processing"] as const) {
      expect(availableActions(status)).toEqual([]);
    }
  });

  it("requires a reason for everything except a first activation", () => {
    expect(requiresReason("activate")).toBe(false);
    expect(requiresReason("rollback")).toBe(true);
    expect(requiresReason("reject")).toBe(true);
    expect(requiresReason("archive")).toBe(true);
  });

  it("maps database errors to action codes and never leaks other messages", () => {
    expect(canonErrorFromDatabase("INVALID_TRANSITION")).toBe("INVALID_TRANSITION");
    expect(canonErrorFromDatabase("DUPLICATE_FILE")).toBe("DUPLICATE_FILE");
    expect(canonErrorFromDatabase("relation does not exist")).toBe("UNAVAILABLE");
    expect(canonErrorFromDatabase(undefined)).toBe("UNAVAILABLE");
  });
});

describe("canon schemas", () => {
  const base = { uploadId: UPLOAD_ID, issuingAuthority: "Ministarstvo", officialTitle: "Katalog" };

  it("needs an existing document or a type with a title", () => {
    expect(CanonRegisterSchema.safeParse({ ...base, documentId: DOCUMENT_ID }).success).toBe(true);
    expect(CanonRegisterSchema.safeParse({ ...base, typeCode: "subject_catalogue", documentTitle: "Matematika" }).success).toBe(true);
    expect(CanonRegisterSchema.safeParse({ ...base, typeCode: "subject_catalogue" }).success).toBe(false);
    expect(CanonRegisterSchema.safeParse({ ...base, documentId: "" }).success).toBe(false);
  });

  it("turns empty optional fields into null and validates dates", () => {
    const parsed = CanonRegisterSchema.parse({ ...base, documentId: DOCUMENT_ID, referenceNumber: " ", publishedOn: "" });
    expect(parsed.referenceNumber).toBeNull();
    expect(parsed.publishedOn).toBeNull();
    expect(CanonRegisterSchema.safeParse({ ...base, documentId: DOCUMENT_ID, publishedOn: "2022-02-30" }).success).toBe(false);
    expect(CanonRegisterSchema.safeParse({ ...base, documentId: DOCUMENT_ID, publishedOn: "2022-08-19" }).success).toBe(true);
  });

  it("bounds the lifecycle reason like the database does", () => {
    expect(CanonTransitionSchema.safeParse({ versionId: DOCUMENT_ID, action: "rollback", reason: "x".repeat(500) }).success).toBe(true);
    expect(CanonTransitionSchema.safeParse({ versionId: DOCUMENT_ID, action: "rollback", reason: "x".repeat(501) }).success).toBe(false);
    expect(CanonTransitionSchema.safeParse({ versionId: DOCUMENT_ID, action: "delete" }).success).toBe(false);
  });
});

describe("content security policy for direct uploads", () => {
  it("opens only the signed upload path of the canon bucket", () => {
    const csp = buildContentSecurityPolicy("n", false, "https://abc.supabase.co");
    expect(csp).toContain("connect-src 'self' https://abc.supabase.co/storage/v1/object/upload/sign/canon-documents/;");
    expect(canonUploadPrefix("https://abc.supabase.co/")).toBe("https://abc.supabase.co/storage/v1/object/upload/sign/canon-documents/");
    expect(buildContentSecurityPolicy("n", false)).toContain("connect-src 'self';");
  });
});

describe("catalogue seed manifest (AMB-02)", () => {
  it("matches the official PDFs in the repository byte for byte", async () => {
    for (const catalogue of manifest.catalogues) {
      const file = new Uint8Array(readFileSync(join(__dirname, "../..", catalogue.file)));
      expect(hasPdfSignature(file), catalogue.file).toBe(true);
      expect(isAcceptableSize(file.byteLength), catalogue.file).toBe(true);
      expect(await sha256Hex(file), catalogue.file).toBe(catalogue.sha256);
    }
  });
});

describe("registry display format", () => {
  it("shows Sarajevo time with numeric dates in every interface language", async () => {
    const { formatDateTime } = await import("@/features/canon/components/format");
    expect(formatDateTime("2026-09-27T12:05:00Z", "bs")).toBe("27.09.2026. 14:05");
    expect(formatDateTime("2026-09-27T12:05:00Z", "de")).toBe("27.09.2026, 14:05");
    expect(formatDateTime("2026-01-05T23:30:00Z", "en")).toBe("06/01/2026 00:30");
  });
});
