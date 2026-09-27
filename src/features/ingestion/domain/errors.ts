import type { IngestionErrorCode } from "../types";

const DATABASE_ERRORS: Record<string, IngestionErrorCode> = {
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  INVALID_TRANSITION: "INVALID_TRANSITION",
  VALIDATION: "VALIDATION",
};

/** Map an error raised by record_ingestion_job to an action code; anything else is UNAVAILABLE. */
export function ingestionErrorFromDatabase(message: string | undefined): IngestionErrorCode {
  return (message && DATABASE_ERRORS[message.trim()]) || "UNAVAILABLE";
}
