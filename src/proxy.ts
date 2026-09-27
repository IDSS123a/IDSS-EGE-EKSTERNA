import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { APP_HOME_PATH, LOGIN_PATH } from "@/constants";
import { SESSION_COOKIE_OPTIONS } from "@/lib/db/cookie-options";
import { buildContentSecurityPolicy, createNonce } from "@/features/security/csp";

/**
 * Next.js 16 proxy (formerly middleware), on every page request:
 * 1. Content-Security-Policy with a fresh nonce (mandate §7A.7);
 * 2. Supabase session refresh and OPTIMISTIC redirects between /prijava and /app.
 * Real authorisation happens again in every page and Server Action (requireAccount, RLS) —
 * the proxy is never the only line of defence (Next.js authentication guide).
 */
const SUPABASE_AUTH_COOKIE = /^sb-.*-auth-token/;
const NONCE_HEADER = "x-nonce";
const CSP_HEADER = "Content-Security-Policy";

function isProtected(pathname: string): boolean {
  return pathname === APP_HOME_PATH || pathname.startsWith(`${APP_HOME_PATH}/`);
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const nonce = createNonce();
  const csp = buildContentSecurityPolicy(nonce, process.env.NODE_ENV === "development");

  /** Continue to the page with the nonce + CSP on the request (Next.js applies the nonce while rendering). */
  const forward = (): NextResponse => {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(NONCE_HEADER, nonce);
    requestHeaders.set(CSP_HEADER, csp);
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set(CSP_HEADER, csp);
    return response;
  };
  const redirectTo = (path: string): NextResponse => NextResponse.redirect(new URL(path, request.url));

  const hasSessionCookie = request.cookies.getAll().some((cookie) => SUPABASE_AUTH_COOKIE.test(cookie.name));
  if (!hasSessionCookie) return isProtected(request.nextUrl.pathname) ? redirectTo(LOGIN_PATH) : forward();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return forward();

  let refreshedCookies: { name: string; value: string; options: Record<string, unknown> }[] = [];
  let cacheHeaders: Record<string, string> = {};
  const supabase = createServerClient(url, anonKey, {
    cookieOptions: SESSION_COOKIE_OPTIONS,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headersToSet) => {
        // Make refreshed tokens visible to this request's render, then to the browser.
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        refreshedCookies = cookiesToSet;
        cacheHeaders = headersToSet;
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  if (!data.user && isProtected(request.nextUrl.pathname)) return redirectTo(LOGIN_PATH);
  if (data.user && request.nextUrl.pathname === LOGIN_PATH) return redirectTo(APP_HOME_PATH);

  const response = forward();
  refreshedCookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  Object.entries(cacheHeaders).forEach(([key, value]) => response.headers.set(key, value));
  return response;
}

export const config = {
  matcher: [
    {
      // Everything except static assets, the splash module and brand files; skip link prefetches.
      source: "/((?!_next/static|_next/image|splash/|brand/|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
