import { describe, expect, it } from "vitest";

import { calendarJobCardTone } from "../utils/calendarJobCardTone";

describe("calendarJobCardTone", () => {
  it("gives completed jobs the pink completed treatment regardless of job type, not dimmed", () => {
    for (const type of ["Install", "Service", "Maintenance", "Inspection", "Estimate", "Callback"] as const) {
      const tone = calendarJobCardTone({ status: "Completed", type });
      expect(tone).toContain("completed-card");
      expect(tone).not.toContain("opacity");
      expect(tone).not.toContain("emerald");
      expect(tone).not.toContain("slate");
    }
  });

  it("keeps the job-type tint for jobs that are not completed", () => {
    expect(calendarJobCardTone({ status: "Scheduled", type: "Install" })).toContain("blue");
    expect(calendarJobCardTone({ status: "In Progress", type: "Callback" })).toContain("rose");
    expect(calendarJobCardTone({ status: "Scheduled", type: "Install" })).not.toContain("opacity-70");
  });

  it("makes a completed Install look different from a scheduled Install", () => {
    expect(calendarJobCardTone({ status: "Completed", type: "Install" })).not.toBe(
      calendarJobCardTone({ status: "Scheduled", type: "Install" }),
    );
  });
});
