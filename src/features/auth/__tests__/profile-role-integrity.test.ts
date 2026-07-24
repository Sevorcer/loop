/**
 * Profile Role Integrity Tests
 *
 * Regression coverage ensuring app_role = null can never silently propagate
 * through the application layer to the database.
 *
 * The user_profiles table enforces a NOT NULL constraint on app_role at the
 * DB level. These tests verify the application-layer gatekeepers that prevent
 * null roles from ever reaching a write path.
 */
import { describe, expect, it } from "vitest";

import {
  DEFAULT_APP_ROLE,
  isAppRole,
  resolveAuthUserRole,
} from "@/features/auth/utils/appRole";

// ---------------------------------------------------------------------------
// isAppRole — guards against null/invalid values at call sites
// ---------------------------------------------------------------------------

describe("isAppRole — rejects null and invalid values", () => {
  it("rejects null", () => {
    expect(isAppRole(null)).toBe(false);
  });

  it("rejects undefined", () => {
    expect(isAppRole(undefined)).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isAppRole("")).toBe(false);
  });

  it("rejects unrecognised role strings", () => {
    expect(isAppRole("viewer")).toBe(false);
    expect(isAppRole("superadmin")).toBe(false);
    expect(isAppRole("OWNER")).toBe(false);
  });

  it("accepts every valid AppRole", () => {
    const validRoles = ["owner", "manager", "dispatch", "tech", "office", "sales", "portal"];
    for (const role of validRoles) {
      expect(isAppRole(role)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// DEFAULT_APP_ROLE — must be a defined, valid role (not null)
// ---------------------------------------------------------------------------

describe("DEFAULT_APP_ROLE — is a valid non-null role", () => {
  it("is defined", () => {
    expect(DEFAULT_APP_ROLE).toBeDefined();
  });

  it("is not null", () => {
    expect(DEFAULT_APP_ROLE).not.toBeNull();
  });

  it("passes isAppRole validation", () => {
    expect(isAppRole(DEFAULT_APP_ROLE)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// resolveAuthUserRole — returns null for missing/empty metadata
// Ensures null role metadata does not produce a truthy role value.
// ---------------------------------------------------------------------------

describe("resolveAuthUserRole — returns null when role is absent", () => {
  it("returns null for a null user", () => {
    expect(resolveAuthUserRole(null)).toBeNull();
  });

  it("returns null for an undefined user", () => {
    expect(resolveAuthUserRole(undefined)).toBeNull();
  });

  it("returns null when both metadata objects are empty", () => {
    expect(
      resolveAuthUserRole({ app_metadata: {}, user_metadata: {} } as never),
    ).toBeNull();
  });

  it("returns null when metadata fields are undefined", () => {
    expect(
      resolveAuthUserRole({ app_metadata: undefined, user_metadata: undefined } as never),
    ).toBeNull();
  });

  it("returns null for invalid role values in metadata", () => {
    expect(
      resolveAuthUserRole({
        app_metadata: { app_role: null },
        user_metadata: { app_role: null },
      } as never),
    ).toBeNull();

    expect(
      resolveAuthUserRole({
        app_metadata: { role: "superadmin" },
        user_metadata: {},
      } as never),
    ).toBeNull();
  });
});
