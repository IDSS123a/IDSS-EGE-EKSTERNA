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

const GeminiEnvSchema = z.object({ GEMINI_API_KEY: z.string().min(20).optional(), GOOGLE_API_KEY: z.string().min(20).optional() });

/**
 * Gemini API key for embeddings (PDL-023) — server only, never NEXT_PUBLIC_ (A-8). GEMINI_API_KEY is
 * preferred; GOOGLE_API_KEY (the Google SDK's other name) is accepted. Null when not configured: the
 * search then stays on full-text ranking.
 */
export function getGeminiApiKey(): string | null {
  const parsed = GeminiEnvSchema.safeParse(process.env);
  if (!parsed.success) return null;
  return parsed.data.GEMINI_API_KEY ?? parsed.data.GOOGLE_API_KEY ?? null;
}
