import "server-only";
import { z } from "zod";

/**
 * Server-side environment, validated on first use (E-2). Reading lazily keeps `next build`
 * working in environments without secrets; any request that needs Supabase then fails loudly
 * with a configuration error instead of a silent 500 (DONE checklist, post-deploy).
 */
const PublicSupabaseEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
});
const ServiceRoleEnvSchema = z.object({ SUPABASE_SERVICE_ROLE_KEY: z.string().min(20) });

export type PublicSupabaseEnv = { url: string; anonKey: string };

/** Thrown when required environment variables are missing or malformed. */
export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

/**
 * Supabase URL and anon/publishable key.
 * @throws ConfigurationError when missing
 */
export function getPublicSupabaseEnv(): PublicSupabaseEnv {
  const parsed = PublicSupabaseEnvSchema.safeParse(process.env);
  if (!parsed.success) throw new ConfigurationError("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY missing or invalid");
  return { url: parsed.data.NEXT_PUBLIC_SUPABASE_URL, anonKey: parsed.data.NEXT_PUBLIC_SUPABASE_ANON_KEY };
}

/**
 * Service-role key — server only, never NEXT_PUBLIC_ (A-8).
 * @throws ConfigurationError when missing
 */
export function getServiceRoleKey(): string {
  const parsed = ServiceRoleEnvSchema.safeParse(process.env);
  if (!parsed.success) throw new ConfigurationError("SUPABASE_SERVICE_ROLE_KEY missing or invalid");
  return parsed.data.SUPABASE_SERVICE_ROLE_KEY;
}

const GEMINI_KEY_NAME = /^(GEMINI_API_KEY(?:_([0-9]{1,2}))?|GOOGLE_API_KEY)$/;
const MIN_KEY_LENGTH = 20;

/**
 * Gemini API keys for embeddings (PDL-023) — server only, never NEXT_PUBLIC_ (A-8). Several keys rotate when one
 * reaches its quota (Director, 27.09.2026): GEMINI_API_KEY, then GEMINI_API_KEY_1, GEMINI_API_KEY_2, ... in number
 * order, then GOOGLE_API_KEY. Empty or too short values are ignored; duplicates count once. An empty list means
 * search by meaning is not configured and search works by words.
 */
export function getGeminiApiKeys(env: Record<string, string | undefined> = process.env): string[] {
  const order = (name: string): number => {
    if (name === "GEMINI_API_KEY") return 0;
    if (name === "GOOGLE_API_KEY") return 1000;
    return Number(GEMINI_KEY_NAME.exec(name)?.[2] ?? 999);
  };
  const names = Object.keys(env).filter((name) => GEMINI_KEY_NAME.test(name)).sort((a, b) => order(a) - order(b));
  const keys: string[] = [];
  for (const name of names) {
    const value = env[name]?.trim();
    if (value && value.length >= MIN_KEY_LENGTH && !keys.includes(value)) keys.push(value);
  }
  return keys;
}
