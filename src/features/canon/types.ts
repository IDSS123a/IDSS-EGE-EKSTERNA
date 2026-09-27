/** Lifecycle states of a canonical document version (enum canon_version_status, migration 002). */
export type CanonVersionStatus =
  | "draft"
  | "processing"
  | "validation_required"
  | "active"
  | "superseded"
  | "archived"
  | "rejected";

/** Events of the append-only version history (migration 006). */
export type CanonEvent = "uploaded" | "activated" | "rolled_back" | "superseded" | "rejected" | "archived";

/** Lifecycle actions offered on a version; the database decides again (activate_canon_version, set_canon_version_status). */
export type CanonAction = "activate" | "rollback" | "reject" | "archive";

export type CanonDocumentType = {
  code: string;
  name: string;
  authorityLevel: number;
  /** What the application may derive from documents of this type (e.g. questions, rules). */
  derives: string[];
};

export type CanonVersion = {
  id: string;
  status: CanonVersionStatus;
  officialTitle: string;
  issuingAuthority: string;
  referenceNumber: string | null;
  publishedOn: string | null;
  effectiveFrom: string | null;
  revisionLabel: string | null;
  sha256: string;
  byteSize: number;
  uploadedAt: string;
  activatedAt: string | null;
  /** Derived records per state (dependency map, filled from Sprint 03). */
  dependents: { current: number; stale: number };
};

export type CanonHistoryEntry = {
  id: number;
  versionId: string;
  event: CanonEvent;
  actorName: string;
  reason: string | null;
  generation: number | null;
  occurredAt: string;
};

export type CanonDocument = {
  id: string;
  title: string;
  typeCode: string;
  subjectLabel: string | null;
  createdAt: string;
  versions: CanonVersion[];
  history: CanonHistoryEntry[];
};

export type CanonRegistry = {
  types: CanonDocumentType[];
  documents: CanonDocument[];
  generation: number;
};

/** Machine codes returned by canon actions; the UI localises them (AMB-11). */
export type CanonErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "VALIDATION"
  | "TOO_LARGE"
  | "NOT_PDF"
  | "UPLOAD_MISSING"
  | "DUPLICATE_FILE"
  | "NOT_FOUND"
  | "INVALID_TRANSITION"
  | "REASON_REQUIRED"
  | "UNAVAILABLE";

/** Standard action result (E-5). */
export type CanonActionResult =
  | { success: true; data: { message: "REGISTERED" | "ACTIVATED" | "ROLLED_BACK" | "REJECTED" | "ARCHIVED" } }
  | { success: false; code: CanonErrorCode };

/** Result of preparing a direct upload: a single-use signed URL for the staging object. */
export type CanonUploadTicket =
  | { success: true; data: { uploadId: string; uploadUrl: string } }
  | { success: false; code: CanonErrorCode };
