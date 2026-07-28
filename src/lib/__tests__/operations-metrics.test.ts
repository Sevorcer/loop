import { describe, expect, it } from "vitest";

import {
  normalizeJobStatus,
  isOpenStatus,
  getStatusVariants,
} from "@/lib/jobs/status";
import {
  DASHBOARD_METRIC_DEFINITIONS,
  COMMAND_CENTER_KPI_DEFINITIONS,
} from "@/lib/operationsMetricDefinitions";

describe("job status normalization", () => {
  it("normalizes status aliases used by legacy records", () => {
    expect(normalizeJobStatus("in_progress")).toBe("In Progress");
    expect(normalizeJobStatus("waiting_on_parts")).toBe("On Hold");
    expect(normalizeJobStatus("canceled")).toBe("Cancelled");
  });

  it("classifies open/closed statuses consistently", () => {
    expect(isOpenStatus("Scheduled")).toBe(true);
    expect(isOpenStatus("On Hold")).toBe(true);
    expect(isOpenStatus("Completed")).toBe(false);
    expect(isOpenStatus("Cancelled")).toBe(false);
  });

  it("returns query variants for canonical statuses", () => {
    const variants = getStatusVariants(["On Hold"]);
    expect(variants).toContain("On Hold");
    expect(variants).toContain("waiting_on_parts");
  });
});

describe("shared operations metric definitions", () => {
  it("keeps dashboard and command-center labels aligned for shared metrics", () => {
    expect(DASHBOARD_METRIC_DEFINITIONS.scheduledToday.label).toBe(
      COMMAND_CENTER_KPI_DEFINITIONS.jobsToday.label,
    );
    expect(DASHBOARD_METRIC_DEFINITIONS.completedToday.label).toBe(
      COMMAND_CENTER_KPI_DEFINITIONS.completedToday.label,
    );
  });
});
