import type { AccountRole, AccountStatus } from "@/features/authentication/types";

/** One row of the account list (no personal data beyond what the account screen needs). */
export type AccountSummary = {
  userId: string;
  username: string;
  displayName: string;
  role: AccountRole;
  status: AccountStatus;
  bundles: string[];
  /** Subject ids of the account's subject_teacher grants. */
  teachesSubjectIds: string[];
  createdAt: string;
};

/** Machine codes returned by account actions; the UI localises them (AMB-11). */
export type AccountErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "VALIDATION"
  | "USERNAME_TAKEN"
  | "USERNAME_ROLE_MISMATCH"
  | "PWNED_PASSWORD"
  | "NOT_FOUND"
  | "UNAVAILABLE";

/** Standard action result (E-5). */
export type AccountActionResult =
  | { success: true; data: { message: "CREATED" | "STATUS_CHANGED" | "BUNDLE_CHANGED" | "PASSWORD_RESET" } }
  | { success: false; code: AccountErrorCode };
