import type { ReviewErrorCode } from "../types";

const KNOWN: ReviewErrorCode[] = ["FORBIDDEN", "VALIDATION", "NOT_FOUND", "SUBJECT_MISSING", "STALE_RECORD", "ALREADY_ACCEPTED", "NOT_ACCEPTABLE"];

/** Map a machine message raised by a migration 008 review function to an action error code. */
export function reviewErrorFromDatabase(message: string): ReviewErrorCode {
  return KNOWN.find((code) => message === code) ?? "UNAVAILABLE";
}
