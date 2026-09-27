/**
 * Content-Security-Policy (mandate §7A.7, Commander E-4). A fresh nonce per request allows
 * only Next.js' own scripts and the first-paint splash module; `strict-dynamic` lets those
 * trusted scripts load their chunks. No inline or third-party script can run.
 * Framework-free so it can be unit-tested.
 */

/**
 * Build the CSP header value.
 * @param nonce per-request random nonce (base64)
 * @param isDevelopment React needs `unsafe-eval` for dev-only error overlays
 */
export function buildContentSecurityPolicy(nonce: string, isDevelopment: boolean): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    // Style attributes set through the CSSOM (splash grain) are not governed by CSP;
    // inline <style> blocks need the nonce.
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data: blob:",
    "font-src 'self'",
    // The browser never talks to Supabase directly: all data access runs on the server.
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
  ];
  return directives.join("; ");
}

/** Cryptographically random nonce, base64 (Web Crypto, available in the Node proxy runtime). */
export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}
