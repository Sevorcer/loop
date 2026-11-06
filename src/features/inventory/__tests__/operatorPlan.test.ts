import { describe, expect, it } from "vitest";

import { planOperatorChanges } from "../utils/operatorPlan";

describe("planOperatorChanges", () => {
  it("adds, updates home, and removes", () => {
    const plan = planOperatorChanges(
      [
        { userId: "casey", isHome: true },
        { userId: "nate", isHome: false },
      ],
      [
        { userId: "casey", isHome: false },
        { userId: "alex", isHome: true },
      ],
    );
    expect(plan.problems).toEqual([]);
    expect(plan.add).toEqual([{ userId: "alex", isHome: true }]);
    expect(plan.update).toEqual([{ userId: "casey", isHome: false }]);
    expect(plan.remove).toEqual(["nate"]);
    expect(plan.clearHomeUserIds).toEqual(["alex"]);
  });

  it("clears the previous home before this van becomes home", () => {
    const plan = planOperatorChanges([], [{ userId: "casey", isHome: true }]);
    expect(plan.clearHomeUserIds).toEqual(["casey"]);
    expect(plan.add).toEqual([{ userId: "casey", isHome: true }]);
  });

  it("rejects a duplicate person", () => {
    const plan = planOperatorChanges(
      [],
      [
        { userId: "casey", isHome: true },
        { userId: "casey", isHome: false },
      ],
    );
    expect(plan.problems).toContain("Each person can only be listed once.");
    expect(plan.add).toEqual([{ userId: "casey", isHome: true }]);
  });

  it("leaves an unchanged assignment alone", () => {
    const plan = planOperatorChanges([{ userId: "casey", isHome: true }], [{ userId: "casey", isHome: true }]);
    expect(plan.add).toEqual([]);
    expect(plan.update).toEqual([]);
    expect(plan.remove).toEqual([]);
    expect(plan.clearHomeUserIds).toEqual(["casey"]);
  });
});
