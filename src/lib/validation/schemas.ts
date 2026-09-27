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
