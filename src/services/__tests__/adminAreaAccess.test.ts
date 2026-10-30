import { describe, expect, it } from "vitest";

import { canAccessAdminArea, resolveAdminAreaRole } from "@/services/authorization";

describe("admin area access", () => {
  it("lets owners and managers in", () => {
    expect(canAccessAdminArea("owner")).toBe(true);
    expect(canAccessAdminArea("manager")).toBe(true);
  });

  it("blocks technicians and other field roles", () => {
    for (const role of ["tech", "dispatch", "office", "sales", "portal"]) {
      expect(canAccessAdminArea(role)).toBe(false);
    }
    expect(canAccessAdminArea(null)).toBe(false);
    expect(canAccessAdminArea(undefined)).toBe(false);
  });

  it("trusts the profile role over the sign-in token", () => {
    expect(resolveAdminAreaRole("owner", null)).toBe("owner");
    expect(resolveAdminAreaRole("tech", "owner")).toBe("tech");
    expect(resolveAdminAreaRole(null, "owner")).toBe("owner");
    expect(resolveAdminAreaRole(null, "tech")).toBe("tech");
    expect(resolveAdminAreaRole(null, null)).toBeNull();
  });

  it("does not treat an unknown profile value as access", () => {
    expect(resolveAdminAreaRole("platform_admin", "tech")).toBe("tech");
    expect(canAccessAdminArea(resolveAdminAreaRole("tech", "owner"))).toBe(false);
    expect(canAccessAdminArea(resolveAdminAreaRole("owner", null))).toBe(true);
    expect(canAccessAdminArea(resolveAdminAreaRole("manager", null))).toBe(true);
  });
});
