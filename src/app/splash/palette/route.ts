import { NextResponse } from "next/server";
import { SPLASH_PALETTE_MAX_AGE_SECONDS } from "@/constants";
import { readSplashPalette } from "@/features/settings/repository";
import { DEFAULT_SPLASH_SHARES, thresholdsFor } from "@/features/splash/palette";
import { createSupabaseAdminClient } from "@/lib/db/supabase-admin";
import { logError } from "@/lib/logger";

/**
 * GET /splash/palette — the splash palette for the first-paint splash (public, before sign-in; PDL-020).
 * Returns the Director's shares in percent and the shader thresholds that produce them. Contains no personal
 * or canonical data. On any error the default palette is returned, so the splash never breaks.
 */
export async function GET(): Promise<NextResponse> {
  let shares = DEFAULT_SPLASH_SHARES;
  try {
    shares = await readSplashPalette(createSupabaseAdminClient());
  } catch (error) {
    logError("app/splash/palette.GET", error);
  }
  return NextResponse.json(
    { shares, thresholds: thresholdsFor(shares) },
    { headers: { "Cache-Control": `public, max-age=${SPLASH_PALETTE_MAX_AGE_SECONDS}, s-maxage=${SPLASH_PALETTE_MAX_AGE_SECONDS}` } },
  );
}
