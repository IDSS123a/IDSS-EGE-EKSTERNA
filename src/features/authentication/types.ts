/** Account roles and statuses mirror the database enums in migrations/001_identity.sql. */
export type AccountRole = "superadmin" | "administrator" | "student";
export type AccountStatus = "invited" | "active" | "suspended" | "blocked" | "deactivated" | "archived";

/** The signed-in account as resolved from the database on every request (never from JWT claims). */
export type CurrentAccount = {
  userId: string;
  username: string;
  displayName: string;
  role: AccountRole;
  status: AccountStatus;
  /** Capability codes held through the role and granted bundles (migrations/001_identity.sql). */
  capabilities: ReadonlySet<string>;
  /**
   * Subject scope per capability: "all" when held through the role or an unscoped bundle, else the
   * subject ids of scoped bundles (subject_teacher, migration 008). The database enforces the same.
   */
  subjectScopes: ReadonlyMap<string, "all" | ReadonlySet<string>>;
};

/** Machine codes returned by the login action; the UI maps them to localised text (AMB-11). */
export type LoginErrorCode = "VALIDATION" | "INVALID_CREDENTIALS" | "LOCKED" | "UNAVAILABLE";

/**
 * Standard action result shape (E-5). A failed attempt echoes the caller's own normalised
 * username back so the field is not cleared (never the password).
 */
export type LoginResult = { success: true } | { success: false; code: LoginErrorCode; username?: string };
