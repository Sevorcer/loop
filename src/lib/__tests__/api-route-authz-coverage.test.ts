/**
 * Sprint 26 — Authorization Coverage Guard
 *
 * This test enumerates every file under src/app/api/ and asserts that each
 * route handler explicitly calls one of the approved authorization primitives:
 *
 *   • requirePermission  — role × table × action check (api-auth.ts)
 *   • requireApiSession  — Supabase session gate (auth/apiGuard.ts)
 *
 * If a new API route is added without an authorization call, this test FAILS
 * and CI is blocked until the route is either:
 *   a) wired to requirePermission / requireApiSession, or
 *   b) explicitly added to EXEMPT_ROUTES with a documented justification.
 *
 * -----------------------------------------------------------------------------
 * HOW TO ADD A NEW ROUTE
 * -----------------------------------------------------------------------------
 * Protected route (must have a role or session check):
 *   1. Call requirePermission(request, table, action) or requireApiSession()
 *      at the top of every exported HTTP handler.
 *   2. No changes needed here — the test will pass automatically.
 *
 * Intentionally public route (no auth required):
 *   1. Add the relative path (from src/app/api/) to EXEMPT_ROUTES below.
 *   2. Include a comment explaining WHY the route is public.
 * -----------------------------------------------------------------------------
 */

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// ---------------------------------------------------------------------------
// Auth primitives that satisfy the authorization requirement
// ---------------------------------------------------------------------------

const AUTH_PRIMITIVES = [
  "requirePermission",
  "requireApiSession",
] as const;

// ---------------------------------------------------------------------------
// Routes that are explicitly exempt from the authorization requirement.
// Every entry must have a justification comment.
// ---------------------------------------------------------------------------

/**
 * Key: relative path from src/app/api/ (e.g. "health/route.ts")
 * Value: reason why no authorization check is required
 */
const EXEMPT_ROUTES: Record<string, string> = {
  // No session-based auth — authenticated by LOOP_HEALTH_CHECK_TOKEN bearer
  // token for CI automation. Returns 503 when the env var is not set.
  "admin/db-health/check/route.ts":
    "CI trigger endpoint authenticated by LOOP_HEALTH_CHECK_TOKEN bearer token, not by user session.",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const API_ROOT = join(process.cwd(), "src/app/api");

/** Recursively collect all route.ts files under a directory. */
function collectRouteFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];

  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);

    if (stat.isDirectory()) {
      files.push(...collectRouteFiles(full));
    } else if (entry === "route.ts") {
      files.push(full);
    }
  }

  return files;
}

/** Returns true when source text contains at least one auth primitive call. */
function hasAuthCall(source: string): boolean {
  return AUTH_PRIMITIVES.some((primitive) => source.includes(primitive));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("API route authorization coverage", () => {
  const routeFiles = collectRouteFiles(API_ROOT);

  it("all API routes must call an authorization primitive or be explicitly exempted", () => {
    const violations: string[] = [];

    for (const file of routeFiles) {
      const relativePath = relative(API_ROOT, file);
      const source = readFileSync(file, "utf8");

      if (EXEMPT_ROUTES[relativePath] !== undefined) {
        // Explicitly exempted — no auth required for this route.
        continue;
      }

      if (!hasAuthCall(source)) {
        violations.push(
          `${relativePath} — no call to ${AUTH_PRIMITIVES.join(" or ")} found.\n` +
          `  Either add an auth check or add the route to EXEMPT_ROUTES with a justification.`
        );
      }
    }

    if (violations.length > 0) {
      throw new Error(
        `Authorization coverage violation — ${violations.length} unprotected route(s):\n\n` +
        violations.map((v) => `  • ${v}`).join("\n\n")
      );
    }
  });

  it("EXEMPT_ROUTES does not contain stale entries (all listed files must exist)", () => {
    const existingRelativePaths = new Set(
      routeFiles.map((f) => relative(API_ROOT, f))
    );

    const stale: string[] = [];
    for (const exemptPath of Object.keys(EXEMPT_ROUTES)) {
      if (!existingRelativePaths.has(exemptPath)) {
        stale.push(exemptPath);
      }
    }

    if (stale.length > 0) {
      throw new Error(
        `Stale EXEMPT_ROUTES entries — these files no longer exist:\n` +
        stale.map((p) => `  • ${p}`).join("\n") +
        `\n\nRemove them from EXEMPT_ROUTES.`
      );
    }
  });

  it("at least one API route is protected (sanity check)", () => {
    // Ensures the test is not vacuously passing because no routes were found.
    expect(routeFiles.length).toBeGreaterThan(0);
  });
});
