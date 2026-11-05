import { describe, expect, it } from "vitest";

import { formatFollowUpDate, formatFollowUpMarker } from "../utils/followUpFormat";

describe("follow-up formatting", () => {
  it("formats the mark date in the company timezone", () => {
    // 2026-11-06T03:00Z is still Nov 5 in Pacific time.
    expect(formatFollowUpDate("2026-11-06T03:00:00Z")).toBe("Nov 5");
  });

  it("returns an empty string for missing or invalid dates", () => {
    expect(formatFollowUpDate(null)).toBe("");
    expect(formatFollowUpDate("nope")).toBe("");
  });

  it("builds the who/when line and degrades gracefully", () => {
    expect(formatFollowUpMarker("2026-11-05T18:00:00Z", "Allison")).toBe("Marked Nov 5 by Allison");
    expect(formatFollowUpMarker("2026-11-05T18:00:00Z", null)).toBe("Marked Nov 5");
    expect(formatFollowUpMarker(null, " Allison ")).toBe("Marked by Allison");
    expect(formatFollowUpMarker(null, null)).toBe("");
  });
});
