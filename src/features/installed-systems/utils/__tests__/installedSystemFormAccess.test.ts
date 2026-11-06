import { describe, expect, it } from "vitest";

import { canEditWarrantyExpiry } from "../installedSystemFormAccess";
import { isInstallDateValueValid } from "../../components/InstalledSystemForm";

describe("canEditWarrantyExpiry", () => {
  it("allows office-level roles only", () => {
    for (const role of ["owner", "manager", "office", "dispatch"] as const) {
      expect(canEditWarrantyExpiry(role)).toBe(true);
    }
    for (const role of ["tech", "sales", "portal", null, undefined] as const) {
      expect(canEditWarrantyExpiry(role)).toBe(false);
    }
  });
});

describe("isInstallDateValueValid", () => {
  it("still accepts year or full date", () => {
    expect(isInstallDateValueValid("2024")).toBe(true);
    expect(isInstallDateValueValid("2024-06-15")).toBe(true);
    expect(isInstallDateValueValid("")).toBe(false);
  });
});
