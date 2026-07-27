import { describe, it, expect } from "vitest";

import { formatPropertyAddress } from "../utils/formatPropertyAddress";

describe("formatPropertyAddress", () => {
  it("combines address and city with a comma separator", () => {
    expect(
      formatPropertyAddress({ address: "245 Maple Ave", city: "Seattle" }),
    ).toBe("245 Maple Ave, Seattle");
  });

  it("preserves address and city exactly as given (no normalization)", () => {
    expect(
      formatPropertyAddress({ address: "1 Infinite Loop", city: "Cupertino" }),
    ).toBe("1 Infinite Loop, Cupertino");
  });

  it("handles addresses that already contain a city-like suffix", () => {
    expect(
      formatPropertyAddress({
        address: "Suite 100, 800 5th Ave",
        city: "Seattle",
      }),
    ).toBe("Suite 100, 800 5th Ave, Seattle");
  });

  it("works with empty strings without throwing", () => {
    expect(formatPropertyAddress({ address: "", city: "" })).toBe(", ");
  });
});
