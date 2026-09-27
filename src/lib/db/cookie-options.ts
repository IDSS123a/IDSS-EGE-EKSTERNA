import { SESSION_COOKIE_MAX_AGE_SECONDS } from "@/constants";

/**
 * Auth cookie flags (Commander E-4: HTTP-only, SameSite=Strict). The app never uses a browser
 * Supabase client, so the session cookie does not need to be readable by JavaScript.
 */
export const SESSION_COOKIE_OPTIONS = {
  path: "/",
  httpOnly: true,
  sameSite: "strict",
  secure: process.env.NODE_ENV === "production",
  maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
} as const;
