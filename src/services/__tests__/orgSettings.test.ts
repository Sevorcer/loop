import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { readMock, writeMock } = vi.hoisted(() => ({
  readMock: vi.fn(),
  writeMock: vi.fn(),
}));

vi.mock("@/repositories/orgSettings", () => ({
  readOrgSetting: readMock,
  writeOrgSetting: writeMock,
}));

import {
  canSeeFinancials,
  getFinancialsVisibility,
  parseFinancialsVisibility,
  setFinancialsVisibilityForRole,
} from "../orgSettings";

describe("parseFinancialsVisibility", () => {
  it("accepts the three levels and defaults everything else to owner", () => {
    expect(parseFinancialsVisibility("owner")).toBe("owner");
    expect(parseFinancialsVisibility("owner_manager")).toBe("owner_manager");
    expect(parseFinancialsVisibility("revenue_roles")).toBe("revenue_roles");
    for (const bad of [null, undefined, "everyone", 42, {}]) {
      expect(parseFinancialsVisibility(bad)).toBe("owner");
    }
  });
});

describe("canSeeFinancials", () => {
  it("owner always sees financials at every level", () => {
    for (const level of ["owner", "owner_manager", "revenue_roles"] as const) {
      expect(canSeeFinancials("owner", level)).toBe(true);
    }
  });
  it("owner level blocks everyone else", () => {
    for (const role of ["manager", "office", "dispatch", "sales", "tech"]) {
      expect(canSeeFinancials(role, "owner")).toBe(false);
    }
  });
  it("owner_manager adds only manager", () => {
    expect(canSeeFinancials("manager", "owner_manager")).toBe(true);
    expect(canSeeFinancials("office", "owner_manager")).toBe(false);
  });
  it("revenue_roles restores the legacy revenue set (no tech)", () => {
    for (const role of ["manager", "dispatch", "office", "sales"]) {
      expect(canSeeFinancials(role, "revenue_roles")).toBe(true);
    }
    expect(canSeeFinancials("tech", "revenue_roles")).toBe(false);
  });
});

describe("getFinancialsVisibility", () => {
  // NOTE: no mockReset here — resetting this hoisted mock in a beforeEach
  // makes its rejections escape the service's try/catch in this Vitest
  // version (verified empirically 2026-11-04). Each test fully specifies
  // the mock's behavior instead.
  it("reads the stored value", async () => {
    readMock.mockResolvedValue("owner_manager");
    await expect(getFinancialsVisibility()).resolves.toBe("owner_manager");
  });
  it("defaults to owner when unset", async () => {
    readMock.mockResolvedValue(null);
    await expect(getFinancialsVisibility()).resolves.toBe("owner");
  });
  it("defaults to owner when the read fails (fail closed)", async () => {
    readMock.mockImplementation(async () => {
      throw new Error("db down");
    });
    await expect(getFinancialsVisibility()).resolves.toBe("owner");
  });
});

describe("setFinancialsVisibilityForRole", () => {
  beforeEach(() => writeMock.mockReset());
  it("lets the owner set and persist a level", async () => {
    await expect(
      // @ts-expect-error role is the AppRole union; owner is valid
      setFinancialsVisibilityForRole("owner", "user-1", "owner_manager"),
    ).resolves.toBe("owner_manager");
    expect(writeMock).toHaveBeenCalledWith(
      "financials_visibility",
      "owner_manager",
      "user-1",
    );
  });
  it("rejects non-owners and writes nothing", async () => {
    await expect(
      // @ts-expect-error testing a non-owner role
      setFinancialsVisibilityForRole("manager", "user-2", "revenue_roles"),
    ).rejects.toMatchObject({ status: 403 });
    expect(writeMock).not.toHaveBeenCalled();
  });
  it("sanitizes garbage values to the owner default before persisting", async () => {
    await expect(
      // @ts-expect-error owner role with a garbage value
      setFinancialsVisibilityForRole("owner", "user-1", "everyone"),
    ).resolves.toBe("owner");
    expect(writeMock).toHaveBeenCalledWith("financials_visibility", "owner", "user-1");
  });
});
