import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  isProtectedApiRoute,
  isPublicRoute,
  isShellRoute,
  isTokenAuthenticatedApiRoute,
} from "@/lib/auth/routeAccess";
import { ROUTES } from "@/lib/routes";

const PUBLIC_ROUTES = new Set<string>([ROUTES.HOME, ROUTES.SIGN_IN, ROUTES.UPDATE_PASSWORD]);

describe("shell route guard", () => {
  it("protects every route constant except the public auth and home paths", () => {
    for (const path of Object.values(ROUTES)) {
      if (PUBLIC_ROUTES.has(path)) {
        expect(isShellRoute(path), path).toBe(false);
      } else {
        expect(isShellRoute(path), path).toBe(true);
      }
    }
  });

  it("protects every directory under the app shell, including nested ops pages", () => {
    const shellDir = join(process.cwd(), "src/app/(shell)");
    const segments = readdirSync(shellDir).filter((name) =>
      statSync(join(shellDir, name)).isDirectory(),
    );

    expect(segments.length).toBeGreaterThan(0);
    for (const segment of segments) {
      expect(isShellRoute(`/${segment}`), segment).toBe(true);
    }

    expect(isShellRoute("/ops/feedback")).toBe(true);
    expect(isShellRoute("/command-center")).toBe(true);
    expect(isShellRoute("/calendar")).toBe(true);
    expect(isShellRoute("/operations")).toBe(true);
  });

  it("does not treat a longer sibling path as the same prefix", () => {
    expect(isShellRoute("/administrator")).toBe(false);
    expect(isShellRoute("/operations-old")).toBe(false);
    expect(isShellRoute("/jobsite")).toBe(false);
    expect(isPublicRoute("/sign-in")).toBe(true);
    expect(isPublicRoute("/portal/project-1")).toBe(true);
    expect(isShellRoute("/portal")).toBe(false);
  });
});

describe("token-authenticated API routes", () => {
  it("lets only the CI health and smoke endpoints bypass the session guard", () => {
    expect(isTokenAuthenticatedApiRoute("/api/admin/db-health/check")).toBe(true);
    expect(isTokenAuthenticatedApiRoute("/api/admin/smoke-test")).toBe(true);
    expect(isTokenAuthenticatedApiRoute("/api/admin/db-health/check/")).toBe(true);

    expect(isProtectedApiRoute("/api/admin/db-health/check")).toBe(false);
    expect(isProtectedApiRoute("/api/admin/smoke-test")).toBe(false);

    expect(isProtectedApiRoute("/api/admin/db-health/runs")).toBe(true);
    expect(isProtectedApiRoute("/api/admin/db-health/check/extra")).toBe(true);
    expect(isProtectedApiRoute("/api/jobs")).toBe(true);
    expect(isProtectedApiRoute("/api/auth/sign-out")).toBe(false);
    expect(isTokenAuthenticatedApiRoute("/api/admin/db-health/checkup")).toBe(false);
  });
});
