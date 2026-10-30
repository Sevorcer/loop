import { describe, expect, it } from "vitest";

import { chooseDispatchPlanToKeep } from "@/features/dispatch/utils/dispatchPlanIdentity";

describe("chooseDispatchPlanToKeep", () => {
  it("keeps the plan on the job's company day over a newer plan on another day", () => {
    const kept = chooseDispatchPlanToKeep(
      [
        {
          id: "newer-wrong-day",
          targetDate: "2026-10-31",
          updatedAt: "2026-10-30T18:00:00.000Z",
          createdAt: "2026-10-30T15:22:31.000Z",
        },
        {
          id: "company-day",
          targetDate: "2026-10-30",
          updatedAt: "2026-10-30T15:22:30.000Z",
          createdAt: "2026-10-30T15:22:30.000Z",
        },
      ],
      "2026-10-30",
    );

    expect(kept?.id).toBe("company-day");
  });

  it("keeps the newest plan when none match the company day", () => {
    const kept = chooseDispatchPlanToKeep(
      [
        { id: "older", targetDate: "2026-10-01", updatedAt: "2026-10-01T00:00:00.000Z", createdAt: "2026-10-01T00:00:00.000Z" },
        { id: "newer", targetDate: "2026-10-02", updatedAt: "2026-10-02T00:00:00.000Z", createdAt: "2026-10-02T00:00:00.000Z" },
      ],
      "2026-09-30",
    );

    expect(kept?.id).toBe("newer");
  });
});
