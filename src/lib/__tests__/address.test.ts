import { describe, expect, it } from "vitest";

import { joinAddressParts } from "../address";

describe("joinAddressParts", () => {
  it("joins street, city, state, and zip with a comma", () => {
    expect(joinAddressParts(["123 Main St", "Seattle", "WA", "98101"])).toBe(
      "123 Main St, Seattle, WA, 98101",
    );
  });

  it("keeps a street line that already contains a comma", () => {
    expect(joinAddressParts(["Suite 100, 800 5th Ave", "Seattle"])).toBe(
      "Suite 100, 800 5th Ave, Seattle",
    );
  });

  it("skips blank parts without leaving a stray comma", () => {
    expect(joinAddressParts(["123 Main St", "", "WA", "98101"])).toBe(
      "123 Main St, WA, 98101",
    );
    expect(joinAddressParts([null, "Seattle", undefined, "98101"])).toBe(
      "Seattle, 98101",
    );
    expect(joinAddressParts(["", "Marysville"])).toBe("Marysville");
    expect(joinAddressParts(["14126 51st Ave NE", ""])).toBe("14126 51st Ave NE");
  });

  it("returns an empty string when every part is blank", () => {
    expect(joinAddressParts(["", "  ", null, undefined, ",,", " , "])).toBe("");
    expect(joinAddressParts([])).toBe("");
  });

  it("drops leading, trailing, and repeated commas and extra spaces", () => {
    expect(joinAddressParts([", Seattle", "WA"])).toBe("Seattle, WA");
    expect(joinAddressParts(["123 Main St,", "Seattle"])).toBe("123 Main St, Seattle");
    expect(joinAddressParts(["123 Main St,, Seattle"])).toBe("123 Main St, Seattle");
    expect(joinAddressParts(["  123   Main St  ", "  Seattle "])).toBe(
      "123 Main St, Seattle",
    );
  });

  it("can join non-address lines and still drop empty parts", () => {
    expect(joinAddressParts(["Jane Doe", "", "Seattle"], " • ")).toBe("Jane Doe • Seattle");
    expect(joinAddressParts(["", "North Hub"], " • ")).toBe("North Hub");
    expect(joinAddressParts(["  ", null], " • ")).toBe("");
  });
});
