import { describe, expect, it } from "vitest";

import { buildFollowUpPatch, normalizeFollowUpNote, FOLLOW_UP_NOTE_MAX } from "../utils/followUpPatch";

const now = new Date("2026-11-05T18:00:00.000Z");

describe("buildFollowUpPatch", () => {
  it("marking stamps who and when", () => {
    expect(
      buildFollowUpPatch({ needed: true, note: "  part on order ", userId: "u1", now }, { needed: false, markedAt: null, markedBy: null }),
    ).toEqual({
      follow_up_needed: true,
      follow_up_note: "part on order",
      follow_up_marked_at: "2026-11-05T18:00:00.000Z",
      follow_up_marked_by: "u1",
    });
  });

  it("unmarking clears the flag, note and stamp", () => {
    expect(
      buildFollowUpPatch({ needed: false, note: "ignored", userId: "u2", now }, { needed: true, markedAt: "2026-11-01T00:00:00Z", markedBy: "u1" }),
    ).toEqual({
      follow_up_needed: false,
      follow_up_note: null,
      follow_up_marked_at: null,
      follow_up_marked_by: null,
    });
  });

  it("re-saving a note on a flagged job keeps the original who/when", () => {
    expect(
      buildFollowUpPatch({ needed: true, note: "now back-ordered", userId: "u2", now }, { needed: true, markedAt: "2026-11-01T00:00:00Z", markedBy: "u1" }),
    ).toEqual({
      follow_up_needed: true,
      follow_up_note: "now back-ordered",
      follow_up_marked_at: "2026-11-01T00:00:00Z",
      follow_up_marked_by: "u1",
    });
  });

  it("marking with no note stores null, and a job with no prior state is treated as unmarked", () => {
    const patch = buildFollowUpPatch({ needed: true, userId: "u1", now }, null);
    expect(patch.follow_up_note).toBeNull();
    expect(patch.follow_up_marked_by).toBe("u1");
  });
});

describe("normalizeFollowUpNote", () => {
  it("trims, nulls blanks and non-strings, and caps length", () => {
    expect(normalizeFollowUpNote("   ")).toBeNull();
    expect(normalizeFollowUpNote(42)).toBeNull();
    expect(normalizeFollowUpNote("x".repeat(FOLLOW_UP_NOTE_MAX + 50))).toHaveLength(FOLLOW_UP_NOTE_MAX);
  });
});
