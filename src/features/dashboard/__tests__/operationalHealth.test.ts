import { describe, expect, it } from "vitest";

import type { DashboardSummary } from "@/repositories/dashboard";

import {
  buildAttentionItems,
  buildOperationalHealth,
  dispatchStatusLabel,
} from "../data/operationalHealth";

const quietSummary: DashboardSummary = {
  activeJobs: 0,
  completedToday: 0,
  scheduledToday: 0,
  blockedJobs: 0,
  unassignedJobs: 0,
  newCustomersThisMonth: 0,
  totalProperties: 0,
  activeCrews: 0,
  openCallbacks: 0,
  openEstimates: 0,
};

describe("operational health", () => {
  it("does not invent counts when the day is empty", () => {
    const health = buildOperationalHealth(quietSummary);
    expect(health.status).toBe("Quiet");
    expect(health.signals.map((signal) => signal.value)).toEqual([
      "0",
      "0",
      "0",
      "0",
      "No jobs today",
    ]);
    expect(health.context).not.toMatch(/stable|on schedule/i);
  });

  it("marks dispatch from real unassigned and on-hold counts", () => {
    expect(
      dispatchStatusLabel({
        ...quietSummary,
        scheduledToday: 4,
        activeJobs: 2,
        unassignedJobs: 1,
      }),
    ).toBe("Needs attention");
    expect(
      dispatchStatusLabel({
        ...quietSummary,
        scheduledToday: 3,
        activeJobs: 1,
      }),
    ).toBe("On schedule");
  });

  it("builds attention items only from real open jobs", () => {
    const items = buildAttentionItems([
      {
        id: "1",
        jobNumber: "JOB-2001",
        title: "No heat",
        status: "Scheduled",
        type: "Callback",
        assignedTo: "",
      },
      {
        id: "2",
        jobNumber: "JOB-2002",
        title: "Install",
        status: "Completed",
        type: "Install",
        assignedTo: "",
      },
      {
        id: "3",
        jobNumber: "JOB-2003",
        title: "Waiting on board",
        status: "On Hold",
        type: "Service",
        assignedTo: "Alex",
      },
    ]);

    expect(items.map((item) => item.id)).toEqual(["1", "3"]);
    expect(items[0]?.description).toContain("JOB-2001");
    expect(items.some((item) => item.title.includes("Inspection"))).toBe(false);
  });
});
