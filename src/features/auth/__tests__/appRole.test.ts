import { describe, expect, it } from "vitest";

import {
  readStoredDevRole,
  resolveAuthUserRole,
  resolveAuthoritativeRole,
  resolveDisplayedRole,
} from "../utils/appRole";

describe("resolveAuthUserRole", () => {
  it("reads the locked app_metadata role and ignores user_metadata", () => {
    expect(
      resolveAuthUserRole({
        app_metadata: { role: "dispatch" },
        user_metadata: { role: "owner" },
      } as never)
    ).toBe("dispatch");
  });

  it("reads app_metadata.app_role and does not fall back to user_metadata", () => {
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
    ).toBeNull();
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

describe("authoritative role", () => {
  it("treats a technician profile as technician even when user metadata says owner", () => {
    expect(resolveAuthoritativeRole("tech", "owner")).toBe("tech");
    expect(
      resolveDisplayedRole({
        profileRole: "tech",
        appMetadata: { app_role: "owner" },
      }),
    ).toBe("tech");
    expect(
      resolveAuthUserRole({
        app_metadata: {},
        user_metadata: { role: "owner", app_role: "owner" },
      } as never),
    ).toBeNull();
  });
});

describe("readStoredDevRole", () => {
  it("returns null during non-browser execution", () => {
    expect(readStoredDevRole()).toBeNull();
  });
});
