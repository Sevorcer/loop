import { describe, expect, it } from "vitest";

import type { JobActivity } from "../types/jobActivity";
import { getJobStatusIntent, sortJobActivity } from "../utils/jobWorkspace";

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
