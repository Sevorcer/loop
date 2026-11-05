import { describe, expect, it } from "vitest";

import { summarizeJobBoard } from "../jobBoardStats";

describe("summarizeJobBoard", () => {
  it("counts every job on the board, including closed work", () => {
    const jobs = [
      ...Array.from({ length: 5 }, () => ({ status: "Scheduled" })),
      ...Array.from({ length: 3 }, () => ({ status: "In Progress" })),
      ...Array.from({ length: 2 }, () => ({ status: "Cancelled" })),
      { status: "In Progress" },
    ];

    expect(summarizeJobBoard(jobs)).toEqual({
      total: 11,
      inProgress: 4,
      scheduled: 5,
    });
  });

  it("counts status variants the same as the canonical labels", () => {
    expect(
      summarizeJobBoard([
        { status: "in_progress" },
        { status: "scheduled" },
        { status: "waiting on parts" },
        { status: "completed" },
      ]),
    ).toEqual({
      total: 4,
      inProgress: 1,
      scheduled: 1,
    });
  });

  it("returns zeros when the board is empty", () => {
    expect(summarizeJobBoard([])).toEqual({
      total: 0,
      inProgress: 0,
      scheduled: 0,
    });
  });
});
