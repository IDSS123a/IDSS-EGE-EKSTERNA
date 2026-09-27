import type { KnowledgeErrorCode } from "../types";

const KNOWN: KnowledgeErrorCode[] = ["FORBIDDEN", "VALIDATION", "NOT_FOUND", "INVALID_TRANSITION", "INTEGRITY", "ALREADY_LOADED"];

/** Map a machine message raised by a migration 008 function to an action error code. */
export function knowledgeErrorFromDatabase(message: string): KnowledgeErrorCode {
  return KNOWN.find((code) => message === code) ?? "UNAVAILABLE";
}
