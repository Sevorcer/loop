import { describe, expect, it } from "vitest";

import {
  mapOrganizationRouteError,
  organizationNotFound,
  organizationPermissionDenied,
  organizationValidationFailed,
} from "@/lib/organizationsApiErrors";

describe("organizationPermissionDenied", () => {
  it("maps 401 to unauthenticated contract", () => {
    const result = organizationPermissionDenied(401);
    expect(result.status).toBe(401);
    expect(result.error.code).toBe("unauthenticated");
  });

  it("maps non-401 to forbidden contract", () => {
    const result = organizationPermissionDenied(403);
    expect(result.status).toBe(403);
    expect(result.error.code).toBe("forbidden");
  });
});

describe("organizationValidationFailed", () => {
  it("returns validation_failure with filtered field errors", () => {
    const result = organizationValidationFailed({
      name: ["Name is required."],
      empty: [],
      unknown: undefined,
    });

    expect(result.status).toBe(400);
    expect(result.error.code).toBe("validation_failure");
    expect(result.error.fieldErrors).toEqual({
      name: ["Name is required."],
    });
  });
});

describe("organizationNotFound", () => {
  it("returns 404 contract for missing id", () => {
    const result = organizationNotFound("org_123");
    expect(result.status).toBe(404);
    expect(result.error.code).toBe("not_found");
    expect(result.error.message).toContain("org_123");
  });
});

describe("mapOrganizationRouteError", () => {
  it("maps duplicate errors to conflict", () => {
    const result = mapOrganizationRouteError(new Error("duplicate key value violates unique"));
    expect(result.status).toBe(409);
    expect(result.error.code).toBe("conflict");
  });

  it("maps auth errors to unauthenticated", () => {
    const result = mapOrganizationRouteError(new Error("SUPABASE_SESSION_REQUIRED"));
    expect(result.status).toBe(401);
    expect(result.error.code).toBe("unauthenticated");
  });

  it("maps invalid payload errors to validation_failure", () => {
    const result = mapOrganizationRouteError(new Error("invalid organization payload"));
    expect(result.status).toBe(400);
    expect(result.error.code).toBe("validation_failure");
  });
});
