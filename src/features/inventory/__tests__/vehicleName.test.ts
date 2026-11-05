import { describe, expect, it } from "vitest";

import { resolveVehicleName } from "../utils/vehicleName";

describe("resolveVehicleName", () => {
  it("prefers the linked vehicle over legacy text", () => {
    expect(resolveVehicleName({ name: "Van 1" }, "Install Truck 4")).toBe("Van 1");
  });

  it("falls back to legacy text when the row is not linked", () => {
    expect(resolveVehicleName(null, "Unmarked Van")).toBe("Unmarked Van");
    expect(resolveVehicleName(undefined, "jjj")).toBe("jjj");
  });

  it("falls back when the linked vehicle name is blank or unreadable", () => {
    expect(resolveVehicleName({ name: null }, "Install Truck 4")).toBe("Install Truck 4");
    expect(resolveVehicleName({ name: "  " }, "Install Truck 4")).toBe("Install Truck 4");
  });

  it("returns an empty string when nothing is known", () => {
    expect(resolveVehicleName(null, null)).toBe("");
    expect(resolveVehicleName(null, "  ")).toBe("");
  });
});
