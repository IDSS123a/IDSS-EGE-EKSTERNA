/** Machine codes of settings actions; the UI localises them (AMB-11). */
export type SettingsErrorCode = "UNAUTHENTICATED" | "FORBIDDEN" | "VALIDATION" | "UNAVAILABLE";

/** Standard action result (E-5). */
export type SettingsActionResult = { success: true; data: { message: "SAVED" } } | { success: false; code: SettingsErrorCode };
