import { z } from "zod";

/**
 * Shared Zod schemas (Commander E-2: every boundary validated, schemas in one place).
 */

/** Staff log in with their official e-mail; students with a school-issued username (AMB-06, PDL-003). */
export const USERNAME_PATTERN = /^(?:[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|[a-z0-9][a-z0-9._-]{2,59})$/;

/** POST login form. Password length is only bounded, never described, to avoid hinting policy. */
export const LoginSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(120)
    .regex(USERNAME_PATTERN),
  password: z.string().min(1).max(200),
});
export type LoginInput = z.infer<typeof LoginSchema>;

/** Roles that may be created through the UI; the Superadministrator is designated, not created (§7A.1). */
export const CREATABLE_ROLES = ["administrator", "student"] as const;
/** Lifecycle states a manager may set (mandate §7A.4). `invited` is only the initial state. */
export const SETTABLE_STATUSES = ["active", "suspended", "blocked", "deactivated", "archived"] as const;
/** Bundles grantable before exam subjects exist; subject_teacher needs a subject scope (Sprint 04). */
export const GRANTABLE_BUNDLES = ["pedagogue", "psychologist", "admin_operations"] as const;

const passwordSchema = (minLength: number) => z.string().min(minLength).max(200);

/** POST create account. Staff (administrator) username must be an e-mail; students must not use one (AMB-06). */
export function createAccountSchema(minPasswordLength: number) {
  return z
    .object({
      username: z.string().trim().toLowerCase().min(3).max(120).regex(USERNAME_PATTERN),
      displayName: z.string().trim().min(1).max(160),
      role: z.enum(CREATABLE_ROLES),
      password: passwordSchema(minPasswordLength),
    })
    .refine((value) => (value.role === "administrator") === value.username.includes("@"), {
      path: ["username"],
      message: "USERNAME_ROLE_MISMATCH",
    });
}

/** POST change account status. */
export const ChangeStatusSchema = z.object({
  userId: z.uuid(),
  status: z.enum(SETTABLE_STATUSES),
});

/** POST grant or revoke a bundle. */
export const BundleChangeSchema = z.object({
  userId: z.uuid(),
  bundle: z.enum(GRANTABLE_BUNDLES),
  grant: z.enum(["grant", "revoke"]),
});

/** POST reset password. */
export function resetPasswordSchema(minPasswordLength: number) {
  return z.object({ userId: z.uuid(), password: passwordSchema(minPasswordLength) });
}
