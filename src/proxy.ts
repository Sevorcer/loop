/**
 * Next.js Edge Middleware — Auth Session Guard.
 *
 * Responsibilities:
 *   1. Refresh the Supabase session token on every request so it never silently
 *      expires between page navigations.
 *   2. Protect all app-shell routes (`/(shell)/*`) — redirect unauthenticated
 *      users to `/sign-in`.
 *   3. Protect all internal API routes (`/api/*`) — return 401 for
 *      unauthenticated requests (API-specific guard is also available at the
 *      handler level via `requireApiSession()`).
 *   4. Allow public routes (sign-in, portal, static assets) to pass through
 *      without auth checks.
 *
 * Session token refresh is handled here so that Server Components always
 * receive a valid, up-to-date session from `createSupabaseServerClient()`.
 */

import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Route classification helpers
// ---------------------------------------------------------------------------

/** Shell routes that require an authenticated internal user. */
function isShellRoute(pathname: string): boolean {
  const shellPrefixes = [
    "/dashboard",
    "/jobs",
    "/properties",
    "/customers",
    "/contractors",
    "/installed-systems",
    "/vehicle-alerts",
    "/daily-plans",
    "/live-operations",
    "/inventory",
    "/dispatch",
    "/company-brain",
    "/reporting",
    "/settings",
  ];
  return shellPrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Internal API routes that must reject unauthenticated requests. */
function isProtectedApiRoute(pathname: string): boolean {
  // /api/auth/sign-out is handled by Supabase directly (no auth guard needed)
  if (pathname === "/api/auth/sign-out") return false;
  return pathname.startsWith("/api/");
}

/** Routes that are always public (no session required). */
function isPublicRoute(pathname: string): boolean {
  return (
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/portal") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/"
  );
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Pass through public routes without touching session state.
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Build a response object that we can attach Set-Cookie headers to.
  let response = NextResponse.next({
    request,
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    // Env vars not configured — allow through in development without auth.
    // In production, deployment should always have these set.
    if (process.env.NODE_ENV === "production") {
      return NextResponse.redirect(new URL("/sign-in", request.url));
    }
    return response;
  }

  // Create a middleware-aware Supabase client that refreshes tokens via cookies.
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Refresh session — IMPORTANT: call getUser() not getSession() so the JWT
  // is validated server-side.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthenticated = Boolean(user);

  // ── Shell routes ──────────────────────────────────────────────────────────
  if (isShellRoute(pathname)) {
    if (!isAuthenticated) {
      const signInUrl = new URL("/sign-in", request.url);
      // Preserve the intended destination so we can redirect after sign-in.
      signInUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(signInUrl);
    }
    return response;
  }

  // ── Protected API routes ──────────────────────────────────────────────────
  if (isProtectedApiRoute(pathname)) {
    if (!isAuthenticated) {
      return NextResponse.json(
        { error: "Unauthorized", message: "A valid session is required." },
        { status: 401 }
      );
    }
    return response;
  }

  return response;
}

// ---------------------------------------------------------------------------
// Matcher — run middleware on all routes except static files.
// ---------------------------------------------------------------------------

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     *   - _next/static  (static files)
     *   - _next/image   (image optimization)
     *   - favicon.ico   (favicon)
     *   - public files with an extension (e.g. logo.png)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
