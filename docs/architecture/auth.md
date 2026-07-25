# Auth & Session Architecture

**Version:** 1.0  
**Sprint:** 25  
**Status:** Approved  
**Last updated:** 2026-07-25

---

## Overview

LOOP uses **Supabase Auth** (JWT + cookie-based sessions) for internal staff authentication. This document covers the end-to-end session architecture for the app shell, server/API layer, and middleware.

For the external **Project Portal** auth model (homeowner, GC, builder roles), see [`docs/architecture/project-portal/authorization-matrix.md`](project-portal/authorization-matrix.md).

---

## Architecture Diagram

```
Browser
  │
  ├── GET /dashboard (no session cookie)
  │       ↓
  │   middleware.ts         ← refreshes token, checks auth
  │       ↓ 302 /sign-in
  │
  ├── POST /sign-in (email + password)
  │       ↓
  │   SignInScreen (client)  ← supabase.auth.signInWithPassword()
  │       ↓ sets session cookie (Supabase SSR)
  │       ↓ redirect → /dashboard (or ?next= destination)
  │
  └── GET /dashboard (valid session cookie)
          ↓
      middleware.ts          ← refreshes token, user confirmed
          ↓
      ShellLayout (server)   ← getAuthSession() → initialSession
          ↓
      AuthProvider (client)  ← hydrated with initialSession
          ↓
      AppShell / Sidebar     ← UserDisplay + SignOutButton
```

---

## Key Modules

### `src/lib/supabase/client.ts`
Browser-only Supabase client singleton (cookie-based session management handled by `@supabase/ssr`). Use in `"use client"` components only.

### `src/lib/supabase/server.ts`
Cookie-aware Supabase server client. Reads/writes Next.js `cookies()`. Use in Server Components, Route Handlers, and Server Actions. **Never cache across requests.**

### `src/lib/auth/session.ts` — Single Source of Truth
The canonical server-side session API:

| Function | Returns | Use case |
|---|---|---|
| `getAuthSession()` | `AuthSession \| null` | Check session without enforcing it |
| `getCurrentUser()` | `User \| null` | Get user object only |
| `requireSession()` | `AuthSession` (throws redirect) | Protected server components / actions |

Always prefer `getUser()` over `getSession()` — it validates the JWT server-side rather than relying on a potentially stale cached session.

### `src/lib/auth/apiGuard.ts`
Route Handler guard that returns 401 JSON instead of redirecting:

```ts
const sessionResult = await requireApiSession();
if (sessionResult.error) return sessionResult.error;
const { user } = sessionResult;
```

### `src/lib/api-auth.ts`
Single source of truth for protected API authorization failures:

- `requirePermission(request, table, action)` — resolves session + role, returns 401 or 403 using the shared auth error contract
- `unauthorizedResponse(...)` — canonical 401 builder, including `WWW-Authenticate`
- `forbiddenResponse(...)` / `createForbiddenResponse(...)` — canonical 403 builders

### `src/middleware.ts`
Runs on every request. Responsibilities:
1. Refresh the Supabase session token (token auto-rotation).
2. Protect all `/(shell)/*` routes — redirect to `/sign-in?next=<path>` if unauthenticated.
3. Protect all `/api/*` routes — return 401 JSON if unauthenticated.
4. Pass through public routes (`/sign-in`, `/portal`, static assets).

### `src/features/auth/state/AuthProvider.tsx`
Client-side session state, hydrated from the server-resolved session. Provides:
- `user`, `session`, `isLoading`
- `signOut()` — calls `supabase.auth.signOut()`, handles redirect via `onAuthStateChange`

Mounted in `src/app/(shell)/layout.tsx` so all shell routes have access to `useAuth()`.

---

## Session Bootstrap (No Flash)

The shell layout is a **Server Component** that calls `getAuthSession()` before rendering. It passes the resolved session to `<AuthProvider initialSession={...}>` so the client never shows an unauthenticated state momentarily — there is no loading flash.

---

## Sign-In Flow

1. User hits a protected route → middleware redirects to `/sign-in?next=/jobs`
2. `SignInScreen` submits email + password via `supabase.auth.signInWithPassword()`
3. Supabase sets an `sb-*` session cookie via the browser client
4. Redirect to `?next` destination (or `/dashboard`)
5. Middleware on next request validates the cookie, refreshes token

---

## Sign-Out Flow

1. User clicks "Sign out" in Sidebar → `SignOutButton` calls `useAuth().signOut()`
2. `supabase.auth.signOut()` clears session cookies
3. `onAuthStateChange` fires with `null` session
4. `AuthProvider` detects null session → `router.push(ROUTES.SIGN_IN)`

Server-side sign-out endpoint (`POST /api/auth/sign-out`) also available for programmatic/forced logout use cases.

---

## Session Expiry Handling

- Middleware calls `supabase.auth.getUser()` on every request, which automatically refreshes the access token if it's expired (using the refresh token).
- If the refresh token itself is expired, `getUser()` returns `null` and the middleware redirects to `/sign-in`.
- Client-side: `requestJson()` and `AuthProvider` both funnel 401s through a shared recovery helper that uses `location.replace("/sign-in?next=...")`.

There is **no silent broken state** — expired sessions always route back to sign-in.

---

## Auth Error Contract

All protected internal API routes must use the same authorization contract.

### Status rules

| Condition | Status | Client expectation |
|---|---|---|
| Missing token / missing session / expired token / invalid token / revoked session / missing required role claim | `401` | Treat as unauthenticated and start session recovery |
| Authenticated user lacks the required permission for the route | `403` | Keep the current session and show an access-denied state |

### Response shape

```json
// 401
{
  "error": "UNAUTHORIZED",
  "message": "Your session has expired. Please sign in again.",
  "code": 401,
  "reason": "expired_token"
}

// 403
{
  "error": "FORBIDDEN",
  "message": "Role 'office' is not permitted to perform 'select' on 'db_health_check_runs'.",
  "code": 403,
  "reason": "insufficient_permission"
}
```

`reason` is machine-readable and currently uses:

- `missing_token`
- `invalid_token`
- `expired_token`
- `revoked_session`
- `missing_role`
- `insufficient_permission`

### Headers

- `401` responses include a `WWW-Authenticate` header using the `B` + `earer realm="loop"` scheme and an `invalid_token` detail when applicable
- `401` and `403` responses include trace headers when emitted from route guards/middleware
- Auth error responses are sent with `Cache-Control: no-store`

### Client handling

- `401` → `requestJson()` starts the shared sign-in recovery path and uses `location.replace` to avoid redirect loops/back-button churn
- `403` → no redirect; surfaces a deterministic permission-denied message/state

### Normalized endpoints

This contract is enforced across:

- middleware-protected `/api/*` requests
- all `requirePermission(...)` routes under `src/app/api/`
- all `requireApiSession(...)` routes
- admin bearer-token routes for DB health checks and smoke tests
- organization admin routes and route-level auth error mappers

### RLS mapping

Application-layer permission denials and repository/RLS denials both map to `403` when the user is authenticated but not allowed. Session/auth failures map to `401` and must not be masked as `403`.

---

## Protected Routes

| Route pattern | Guard | Behavior when unauth |
|---|---|---|
| `/(shell)/*` | Middleware | Redirect → `/sign-in?next=<path>` |
| `/api/*` (except `/api/auth/*`) | Middleware + `requireApiSession()` | 401 JSON |
| `/portal/*` | PortalProvider (separate auth) | Portal error pages |
| `/sign-in` | — | Public |

---

## Security Properties

- **Deny by default:** Middleware blocks all shell + API routes unless a valid session exists.
- **Server-side JWT validation:** `getUser()` validates the JWT server-side, not just cookie presence.
- **No client-only guards:** Middleware runs at the edge — UI-level guards are supplementary only.
- **RLS + `assertPermission()`:** Auth answers "who are you?"; authorization (`src/services/authorization.ts`) answers "what can you do?" Both layers must be applied for sensitive mutations.
- **Token refresh:** Automatic in middleware on every request.

---

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous (public) key |

Set in `.env.local` for local development and in Vercel project settings for staging/production.

---

## Local Development

1. Copy environment variables:
   ```bash
   cp .env.example .env.local
   # Fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
   ```

2. Start Supabase local stack (optional — uses remote dev project otherwise):
   ```bash
   supabase start
   ```

3. Create a test user in Supabase Auth dashboard or via:
   ```bash
   supabase auth create-user --email you@example.com --password secret
   ```

4. Sign in at `http://localhost:3000/sign-in`

---

## Testing

Auth utilities are tested at:
- `src/lib/auth/__tests__/session.test.ts` — unit tests for `getAuthSession`, `getCurrentUser`, `requireSession`
- `src/features/auth/__tests__/auth-flow.test.ts` — integration tests covering positive, negative, expiry, and regression paths

Run with:
```bash
npm run test
```

---

## Production Observability

Auth/authz operational monitoring and alert thresholds are documented in:

- [`docs/architecture/security/auth-observability.md`](security/auth-observability.md)
- [`docs/runbooks/auth-authz-incidents.md`](../runbooks/auth-authz-incidents.md)
