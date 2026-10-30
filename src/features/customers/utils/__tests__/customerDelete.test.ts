import { describe, expect, it } from "vitest";

import { customerDeleteBlockedMessage } from "../customerDelete";

describe("customerDeleteBlockedMessage", () => {
  it("explains linked jobs and properties in one sentence", () => {
    expect(customerDeleteBlockedMessage(2, 1)).toBe(
      "This customer still has 2 jobs and 1 property. Remove or reassign them first.",
    );
  });

  it("uses the singular when only one record is linked", () => {
    expect(customerDeleteBlockedMessage(1, 0)).toBe(
      "This customer still has 1 job. Remove or reassign them first.",
    );
    expect(customerDeleteBlockedMessage(0, 1)).toBe(
      "This customer still has 1 property. Remove or reassign them first.",
    );
  });

  it("returns nothing when the customer can be deleted", () => {
    expect(customerDeleteBlockedMessage(0, 0)).toBeNull();
  });
});
