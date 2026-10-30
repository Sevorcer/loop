import { describe, expect, it } from "vitest";

import { summarizeJobBoard } from "../jobBoardStats";

describe("summarizeJobBoard", () => {
  it("counts every job on the board, including closed work", () => {
    // The live company board: 11 jobs, of which dispatch already shows all.
    const jobs = [
      ...Array.from({ length: 5 }, () => ({ status: "Scheduled", priority: "Medium" })),
      ...Array.from({ length: 3 }, () => ({ status: "In Progress", priority: "Medium" })),
      ...Array.from({ length: 2 }, () => ({ status: "Cancelled", priority: "Medium" })),
      { status: "In Progress", priority: "High" },
    ];

    expect(summarizeJobBoard(jobs)).toEqual({
      total: 11,
      inProgress: 4,
      scheduled: 5,
      highPriority: 1,
    });
  });

  it("counts status and priority variants the same as the canonical labels", () => {
    expect(
      summarizeJobBoard([
        { status: "in_progress", priority: "high" },
        { status: "scheduled", priority: "Low" },
        { status: "waiting on parts", priority: "HIGH" },
        { status: "completed", priority: "medium" },
      ]),
    ).toEqual({
      total: 4,
      inProgress: 1,
      scheduled: 1,
      highPriority: 2,
    });
  });

  it("returns zeros when the board is empty", () => {
    expect(summarizeJobBoard([])).toEqual({
      total: 0,
      inProgress: 0,
      scheduled: 0,
      highPriority: 0,
    });
  });
});
