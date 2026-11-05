import { describe, expect, it } from "vitest";

import { resolveVehicleName } from "../utils/vehicleName";

describe("resolveVehicleName", () => {
  it("returns the linked vehicle name, trimmed", () => {
    expect(resolveVehicleName({ name: "Van 1" })).toBe("Van 1");
    expect(resolveVehicleName({ name: "  Van 1 " })).toBe("Van 1");
  });

  it("accepts the array shape supabase-js types for an embed", () => {
    expect(resolveVehicleName([{ name: "Van 2" }])).toBe("Van 2");
    expect(resolveVehicleName([])).toBe("");
  });

  it("is empty when no vehicle is linked or the name is blank", () => {
    expect(resolveVehicleName(null)).toBe("");
    expect(resolveVehicleName(undefined)).toBe("");
    expect(resolveVehicleName({ name: null })).toBe("");
    expect(resolveVehicleName({ name: "  " })).toBe("");
  });
});
