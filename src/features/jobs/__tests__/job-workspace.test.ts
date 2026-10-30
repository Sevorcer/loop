import { describe, expect, it } from "vitest";

import type { JobActivity } from "../types/jobActivity";
import type { JobStatus } from "../types/job";
import {
  getJobStatusIntent,
  mergeRecordedActivity,
  sortJobActivity,
  canTransitionStatus,
  getValidNextStatuses,
} from "../utils/jobWorkspace";

describe("jobWorkspace", () => {
  it("sorts activity newest-first", () => {
    const activity: JobActivity[] = [
      {
        id: "a-older",
        jobId: "job-1",
        type: "created",
        title: "Created",
        description: "Created",
        timestamp: "2026-07-20T09:00:00.000Z",
      },
      {
        id: "a-newer",
        jobId: "job-1",
        type: "status",
        title: "Status updated",
        description: "In progress",
        timestamp: "2026-07-21T09:00:00.000Z",
      },
    ];

    expect(sortJobActivity(activity).map((item) => item.id)).toEqual([
      "a-newer",
      "a-older",
    ]);
  });

  it("keeps a just-saved price line until the refreshed list includes it", () => {
    const recorded: JobActivity = {
      id: "price-1",
      jobId: "job-1",
      type: "price",
      title: "Job price updated",
      description: "Alex Nguyen set the job price.",
      timestamp: "2026-10-30T18:00:00.000Z",
    };
    const older: JobActivity = {
      id: "created-1",
      jobId: "job-1",
      type: "created",
      title: "Job created",
      description: "Created",
      timestamp: "2026-10-30T17:00:00.000Z",
    };
    const staleRefresh = mergeRecordedActivity([recorded, older], [older], "job-1");
    expect(staleRefresh.map((item) => item.id)).toEqual(["price-1", "created-1"]);
    const caughtUp = mergeRecordedActivity(staleRefresh, [recorded, older], "job-1");
    expect(caughtUp.map((item) => item.id)).toEqual(["price-1", "created-1"]);
  });

  it("returns stable ordering when timestamps match", () => {
    const activity: JobActivity[] = [
      {
        id: "b-entry",
        jobId: "job-1",
        type: "note",
        title: "B",
        description: "B",
        timestamp: "2026-07-21T09:00:00.000Z",
      },
      {
        id: "a-entry",
        jobId: "job-1",
        type: "note",
        title: "A",
        description: "A",
        timestamp: "2026-07-21T09:00:00.000Z",
      },
    ];

    expect(sortJobActivity(activity).map((item) => item.id)).toEqual([
      "a-entry",
      "b-entry",
    ]);
  });

  it("describes on-hold execution intent clearly", () => {
    expect(getJobStatusIntent("On Hold")).toMatch(/blocker resolved/i);
  });
});

// ─── canTransitionStatus ──────────────────────────────────────────────────────

describe("canTransitionStatus", () => {
  it("Scheduled → In Progress is valid", () => {
    expect(canTransitionStatus("Scheduled", "In Progress")).toBe(true);
  });

  it("Scheduled → On Hold is valid", () => {
    expect(canTransitionStatus("Scheduled", "On Hold")).toBe(true);
  });

  it("Scheduled → Cancelled is valid", () => {
    expect(canTransitionStatus("Scheduled", "Cancelled")).toBe(true);
  });

  it("Scheduled → Completed is not valid (must go through In Progress)", () => {
    expect(canTransitionStatus("Scheduled", "Completed")).toBe(false);
  });

  it("In Progress → Completed is valid", () => {
    expect(canTransitionStatus("In Progress", "Completed")).toBe(true);
  });

  it("In Progress → On Hold is valid", () => {
    expect(canTransitionStatus("In Progress", "On Hold")).toBe(true);
  });

  it("In Progress → Cancelled is valid", () => {
    expect(canTransitionStatus("In Progress", "Cancelled")).toBe(true);
  });

  it("On Hold → Scheduled is valid (return to queue)", () => {
    expect(canTransitionStatus("On Hold", "Scheduled")).toBe(true);
  });

  it("On Hold → In Progress is valid (resume)", () => {
    expect(canTransitionStatus("On Hold", "In Progress")).toBe(true);
  });

  it("Completed is a terminal state — no outbound transitions", () => {
    const targets: JobStatus[] = ["Scheduled", "In Progress", "On Hold", "Cancelled"];
    for (const target of targets) {
      expect(canTransitionStatus("Completed", target)).toBe(false);
    }
  });

  it("Cancelled can reopen to Scheduled and nowhere else", () => {
    expect(canTransitionStatus("Cancelled", "Scheduled")).toBe(true);
    const blocked: JobStatus[] = ["In Progress", "On Hold", "Completed"];
    for (const target of blocked) {
      expect(canTransitionStatus("Cancelled", target)).toBe(false);
    }
  });

  it("self-transition is always invalid", () => {
    const statuses: JobStatus[] = ["Scheduled", "In Progress", "On Hold", "Completed", "Cancelled"];
    for (const status of statuses) {
      expect(canTransitionStatus(status, status)).toBe(false);
    }
  });
});

// ─── getValidNextStatuses ─────────────────────────────────────────────────────

describe("getValidNextStatuses", () => {
  it("Scheduled has three valid next statuses", () => {
    const next = getValidNextStatuses("Scheduled");
    expect(next).toHaveLength(3);
    expect(next).toContain("In Progress");
    expect(next).toContain("On Hold");
    expect(next).toContain("Cancelled");
  });

  it("In Progress can complete, pause, or cancel", () => {
    const next = getValidNextStatuses("In Progress");
    expect(next).toContain("Completed");
    expect(next).toContain("On Hold");
    expect(next).toContain("Cancelled");
    expect(next).not.toContain("Scheduled");
  });

  it("On Hold can return to Scheduled or resume In Progress", () => {
    const next = getValidNextStatuses("On Hold");
    expect(next).toContain("Scheduled");
    expect(next).toContain("In Progress");
    expect(next).toContain("Cancelled");
  });

  it("Completed returns empty list (terminal)", () => {
    expect(getValidNextStatuses("Completed")).toEqual([]);
  });

  it("Cancelled can return to the schedule", () => {
    expect(getValidNextStatuses("Cancelled")).toEqual(["Scheduled"]);
  });
});

