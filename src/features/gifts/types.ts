import type { GiftCode } from "./catalogue";

/** A special gift (migration 032). `own` is set for staff lists: the reader gave it. */
export type Gift = { id: string; code: GiftCode; message: string; giver: string; createdAt: string; openedAt: string | null; own?: boolean };

export type GiftErrorCode = "UNAUTHENTICATED" | "FORBIDDEN" | "VALIDATION" | "NOT_FOUND" | "UNAVAILABLE";
export type GiftActionResult = { success: true; data: { id: string } } | { success: false; code: GiftErrorCode };
