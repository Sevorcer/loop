import { describe, expect, it } from "vitest";

import { serialListForSave } from "../utils/serialListForSave";

describe("serialListForSave", () => {
  it("replaces only the first serial and carries the others through", () => {
    expect(serialListForSave("NEW-1", ["OLD-1", "TWO-2", "THREE-3"])).toEqual(["NEW-1", "TWO-2", "THREE-3"]);
  });

  it("clearing the first serial removes only that one", () => {
    expect(serialListForSave("  ", ["OLD-1", "TWO-2"])).toEqual(["TWO-2"]);
  });

  it("drops repeats ignoring case and handles new systems with no list", () => {
    expect(serialListForSave("two-2", ["OLD-1", "TWO-2"])).toEqual(["two-2"]);
    expect(serialListForSave("A-1", undefined)).toEqual(["A-1"]);
    expect(serialListForSave("", undefined)).toEqual([]);
  });
});
