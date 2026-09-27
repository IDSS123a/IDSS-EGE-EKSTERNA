import { CANON_BUCKET } from "@/constants";

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
 * @param supabaseUrl project URL; when given, the browser may PUT to signed canon upload URLs
 *   of the private canon bucket only (Sprint 02). Every other Supabase endpoint stays blocked.
 */
export function buildContentSecurityPolicy(nonce: string, isDevelopment: boolean, supabaseUrl?: string): string {
  const canonUpload = supabaseUrl ? ` ${canonUploadPrefix(supabaseUrl)}` : "";
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    // Style attributes set through the CSSOM (splash grain) are not governed by CSP;
    // inline <style> blocks need the nonce.
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data: blob:",
    "font-src 'self'",
    // All data access runs on the server. The single exception is the direct upload of a
    // canonical PDF to a server-issued, single-use signed URL (files larger than a request body).
    `connect-src 'self'${canonUpload}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDevelopment ? [] : ["upgrade-insecure-requests"]),
  ];
  return directives.join("; ");
}

/**
 * CSP source expression for signed uploads into the canon bucket (path prefix match).
 * @param supabaseUrl project URL, e.g. https://abc.supabase.co
 */
export function canonUploadPrefix(supabaseUrl: string): string {
  return `${new URL(supabaseUrl).origin}/storage/v1/object/upload/sign/${CANON_BUCKET}/`;
}

/** Cryptographically random nonce, base64 (Web Crypto, available in the Node proxy runtime). */
export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}
