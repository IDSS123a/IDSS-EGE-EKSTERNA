import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { APP_HOME_PATH, LOGIN_PATH } from "@/constants";
import { SESSION_COOKIE_OPTIONS } from "@/lib/db/cookie-options";

/**
 * Next.js 16 proxy (formerly middleware): refreshes the Supabase session cookie and performs
 * an OPTIMISTIC redirect of signed-out visitors away from the signed-in area. Real
 * authorisation happens again in every page and Server Action (requireAccount, RLS) — the
 * proxy is never the only line of defence (Next.js authentication guide, mandate §7A.5).
 */
const SUPABASE_AUTH_COOKIE = /^sb-.*-auth-token/;

function isProtected(pathname: string): boolean {
  return pathname === APP_HOME_PATH || pathname.startsWith(`${APP_HOME_PATH}/`);
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const hasSessionCookie = request.cookies.getAll().some((cookie) => SUPABASE_AUTH_COOKIE.test(cookie.name));
  if (!hasSessionCookie) {
    return isProtected(request.nextUrl.pathname)
      ? NextResponse.redirect(new URL(LOGIN_PATH, request.url))
      : NextResponse.next();
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anonKey, {
    cookieOptions: SESSION_COOKIE_OPTIONS,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, cacheHeaders) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(cacheHeaders).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  if (!data.user && isProtected(request.nextUrl.pathname)) {
    return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
  }
  if (data.user && request.nextUrl.pathname === LOGIN_PATH) {
    return NextResponse.redirect(new URL(APP_HOME_PATH, request.url));
  }
  return response;
}

export const config = {
  // Everything except static assets, the splash module and brand files.
  matcher: ["/((?!_next/static|_next/image|splash/|brand/|favicon.ico).*)"],
};
