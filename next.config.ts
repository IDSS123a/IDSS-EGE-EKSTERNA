import type { NextConfig } from "next";

/**
 * Baseline security headers (mandate §7A.7, Commander DONE checklist).
 * The nonce-based Content-Security-Policy is set per request in src/proxy.ts
 * (src/features/security/csp.ts), because it needs a fresh nonce for every response.
 */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The dev-only route indicator (bottom-left in `npm run dev`) confused local reviews of the UI;
  // compile and runtime errors are still shown. Production builds never render it.
  devIndicators: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
