import { describe, expect, it } from "vitest";

import { readStoredDevRole, resolveAuthUserRole } from "../utils/appRole";

describe("resolveAuthUserRole", () => {
  it("prefers app_metadata.role when present", () => {
    expect(
      resolveAuthUserRole({
        app_metadata: { role: "dispatch" },
        user_metadata: { role: "tech" },
      } as never)
    ).toBe("dispatch");
  });

  it("falls back to app_metadata.app_role and user_metadata.role", () => {
    expect(
      resolveAuthUserRole({
        app_metadata: { app_role: "manager" },
        user_metadata: {},
      } as never)
    ).toBe("manager");

    expect(
      resolveAuthUserRole({
        app_metadata: {},
        user_metadata: { role: "office" },
      } as never)
    ).toBe("office");
  });

  it("returns null when user metadata is missing", () => {
    expect(resolveAuthUserRole(null)).toBeNull();
  });

  it("returns null for invalid role metadata", () => {
    expect(
      resolveAuthUserRole({
        app_metadata: { role: "superadmin" },
        user_metadata: {},
      } as never)
    ).toBeNull();
  });
});

describe("readStoredDevRole", () => {
  it("returns null during non-browser execution", () => {
    expect(readStoredDevRole()).toBeNull();
  });
});
