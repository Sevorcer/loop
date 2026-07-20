# UX Permission Display Guidelines

**Version:** 1.0
**Sprint:** 26
**Status:** Approved
**Last updated:** 2026-07-20

---

## Overview

This document defines how the LOOP UI communicates permission boundaries to users — when to hide content, when to show a denied state, and how to prevent flash-of-unauthorized-content during session resolution.

For the underlying permission matrix (which roles can do what), see [`docs/architecture/security/rls-role-matrix.md`](security/rls-role-matrix.md).

For the auth session architecture, see [`docs/architecture/auth.md`](auth.md).

---

## Canonical Pattern Summary

| Scenario | Pattern | Component |
|---|---|---|
| Hide an action button when denied | Invisible (render nothing) | `<PermissionGuard>` |
| Gate an entire page/route | Loading → AccessDenied → Content | `<RoutePermissionGuard>` |
| Show an inline denied section | Show `<AccessDenied showHomeLink={false} />` | `<PermissionGuard fallback={…}>` |

---

## Core Components

All permission UI components live in `src/components/atlas/`. Import from `@/components/atlas`.

### `<PermissionGuard>`

**Use for:** Conditionally rendering an element (button, link, panel) based on role.

```tsx
// Hide a button when the role lacks permission — nothing rendered
<PermissionGuard table="jobs" action="insert">
  <Link href="/jobs/new">
    <Button>New Job</Button>
  </Link>
</PermissionGuard>

// Show an inline denied state for a section
<PermissionGuard table="jobs" action="update" fallback={<AccessDenied showHomeLink={false} />}>
  <JobStatusActions ... />
</PermissionGuard>
```

**Lifecycle:**
1. `loading: true` (role not yet resolved) → renders `null` — **no flash**
2. `allowed: false` → renders `fallback` (default: `null`)
3. `allowed: true` → renders `children`

### `<RoutePermissionGuard>`

**Use for:** Full-page gates on creation and editing routes.

```tsx
// In a form component wrapping a page
<RoutePermissionGuard table="jobs" action="insert">
  <NewJobForm />
</RoutePermissionGuard>
```

**Lifecycle:**
1. Loading → `<LoadingState />` skeleton
2. Denied → `<AccessDenied />` with "Back to Dashboard" link
3. Allowed → `children`

### `<AccessDenied>`

**Use for:** Explicit denied / unauthorized state display.

```tsx
// Full-page block (default — shows "Back to Dashboard")
<AccessDenied />

// Custom message for a specific resource
<AccessDenied
  title="Restricted Area"
  description="Only managers and owners can view reporting data."
  showHomeLink={false}
/>
```

**Accessibility:** Uses `role="alert"` and `aria-live="assertive"` so screen readers announce the denial immediately.

---

## The Canonical `<PermissionGuard>` vs. Legacy `<PermissionGate>`

Two components exist in the codebase. Always use `<PermissionGuard>` from `@/components/atlas`:

| | `PermissionGuard` (Atlas) | `PermissionGate` (features/auth) |
|---|---|---|
| Import | `@/components/atlas` | `@/features/auth` |
| Hook used | `usePermission` from `@/hooks/usePermission` | `usePermission` from `@/features/auth` |
| Context required | `RoleProvider` | `RoleProvider` |
| Returns `{ allowed, loading }` | Yes | No — returns `boolean \| null` |
| **Status** | ✅ Current standard | ⚠️ Legacy — do not use in new code |

`PermissionGate` remains exported for backward compatibility but should not be used in new screens or components.

---

## Provider Setup

The `RoleProvider` is mounted at the shell layout boundary (`src/app/(shell)/layout.tsx`). All screens inside `/(shell)/*` have access to `useCurrentRole()` and `usePermission()`.

```tsx
// src/app/(shell)/layout.tsx
export default async function ShellLayout({ children }) {
  const authSession = await getAuthSession();
  return (
    <AuthProvider initialSession={authSession?.session ?? null}>
      <RoleProvider>
        <AppShell>{children}</AppShell>
      </RoleProvider>
    </AuthProvider>
  );
}
```

`RoleProvider` initializes with `null` during SSR (no window). On client hydration it reads `localStorage.loop_dev_role` (dev) or the JWT claim (production). The `null` → resolved transition happens synchronously in the `useState` initializer, making it effectively flash-free.

---

## No Flash of Unauthorized Content

The permission system is designed so users never see restricted UI flicker before access is checked.

**Guarantee:**
- While `role === null` (SSR / pre-hydration), `usePermission` returns `{ allowed: false, loading: true }`.
- `PermissionGuard` renders `null` while `loading: true`.
- `RoutePermissionGuard` renders `<LoadingState />` skeleton while `loading: true`.
- Content is only shown once `loading: false && allowed: true`.

**Test coverage:** `src/features/auth/__tests__/role-switch-regression.test.ts` — "no flash of unauthorized content" suite.

---

## Decision: Hide vs. Show Denied State

| Situation | Recommendation |
|---|---|
| Action button (New, Edit, Delete) | **Hide** — `<PermissionGuard>` with no fallback |
| Page-level route the user navigated to directly | **Show denied state** — `<RoutePermissionGuard>` |
| Inline section within a page (e.g. status change panel) | **Hide** — `<PermissionGuard>` with no fallback; the section simply doesn't appear |
| Sensitive data summary panel | **Hide** — never show partial data; simply omit the panel |

### Rationale

- **Hiding buttons** avoids confusion about what actions are available. Users should only see buttons they can use.
- **Showing a denied page** (via direct URL) is necessary for clarity: the user navigated intentionally and deserves feedback, not a blank page.
- **Never disable buttons** for permission reasons. A disabled button implies the action is temporarily unavailable (e.g. form not complete), not that the user lacks access. Use `<PermissionGuard>` to hide instead.

---

## Consistency Rules

1. **One component per responsibility.** Use `PermissionGuard` for inline elements, `RoutePermissionGuard` for full pages.
2. **No inline disabled pattern for access control.** Do not set `disabled={!hasPermission(...)}`. Hide the element entirely.
3. **Never hardcode role checks in JSX.** Always go through `PermissionGuard` or `usePermission`.
4. **Always test the denied path.** Every new protected route or action button should have a corresponding entry in `role-switch-regression.test.ts` or `permissions.test.ts`.

---

## Accessibility Checklist for Permission UI

- [ ] `<AccessDenied>` is used for full-page and explicit denied states (not a blank page).
- [ ] `<AccessDenied>` carries `role="alert"` and `aria-live="assertive"` — do not override.
- [ ] Hidden elements are removed from the DOM entirely (via `PermissionGuard` returning `null`), not just visually hidden with CSS.
- [ ] No `aria-disabled` is set on permission-hidden elements — they are not in the DOM.
- [ ] Loading skeletons (`<LoadingState />`) use `aria-busy="true"` or equivalent markup.

---

## Role Switcher (Development)

To simulate different roles during local development, set the `loop_dev_role` key in `localStorage`:

```js
// Browser console:
localStorage.setItem("loop_dev_role", "tech");
location.reload();
```

Or use `useCurrentRole().setDevRole("dispatch")` from a dev toolbar component.

Valid values: `owner`, `manager`, `dispatch`, `tech`, `office`, `sales`, `portal`.

---

## Related

- [RLS Role Matrix](security/rls-role-matrix.md) — full permission table per role and table
- [Auth Architecture](auth.md) — session bootstrap, Supabase integration, sign-in/out flow
- [ATLAS Design System](../atlas.md) — component design language
- Role-switch regression tests: `src/features/auth/__tests__/role-switch-regression.test.ts`
- Navigation permission tests: `src/features/auth/__tests__/permissions.test.ts`
- Authorization unit tests: `src/services/__tests__/authorization.test.ts`
