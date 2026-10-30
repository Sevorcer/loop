import { describe, expect, it } from "vitest";

import {
  EARLIER_NOTE_AUTHOR,
  JOB_NOTE_ACTIVITY_TITLE,
  JOB_NOTE_SAVED_TOAST,
  formatJobNoteTimestamp,
  jobNoteRoleLabel,
  legacyNoteFallback,
  noteBodiesToAppend,
  sortJobNotesNewestFirst,
} from "@/features/jobs/utils/jobNotes";

describe("job note history", () => {
  it("uses a note-specific confirmation, not the QA checklist title", () => {
    expect(JOB_NOTE_SAVED_TOAST).toBe("Note added.");
    expect(JOB_NOTE_ACTIVITY_TITLE).toBe("Note added");
    expect(JOB_NOTE_SAVED_TOAST).not.toMatch(/QA checklist/i);
    expect(JOB_NOTE_ACTIVITY_TITLE).not.toMatch(/QA checklist/i);
  });

  it("keeps an existing office note when the first new note is added", () => {
    expect(
      noteBodiesToAppend({
        existingColumn: "Office: gate code is 1234.",
        historyCount: 0,
        incoming: "Arrived and started the install.",
      }),
    ).toEqual(["Office: gate code is 1234.", "Arrived and started the install."]);
  });

  it("stores the current column once when history is empty and the text matches", () => {
    expect(
      noteBodiesToAppend({
        existingColumn: "Gate code is 1234.",
        historyCount: 0,
        incoming: "Gate code is 1234.",
      }),
    ).toEqual(["Gate code is 1234."]);
  });

  it("appends only the new text once history already exists", () => {
    expect(
      noteBodiesToAppend({
        existingColumn: "Office: gate code is 1234.",
        historyCount: 1,
        incoming: "Replaced the filter.",
      }),
    ).toEqual(["Replaced the filter."]);
  });

  it("still shows the column text when it is not already in the history", () => {
    expect(legacyNoteFallback(["Set the condenser pad."], "Office: gate code is 1234.")).toBe(
      "Office: gate code is 1234.",
    );
    expect(legacyNoteFallback(["Office: gate code is 1234."], "Office: gate code is 1234.")).toBe(
      null,
    );
  });

  it("sorts notes newest first", () => {
    const sorted = sortJobNotesNewestFirst([
      { id: "older", createdAt: "2026-10-01T00:00:00.000Z" },
      { id: "newer", createdAt: "2026-10-30T16:00:00.000Z" },
    ]);
    expect(sorted.map((note) => note.id)).toEqual(["newer", "older"]);
  });

  it("labels the technician role and formats the company-timezone time", () => {
    expect(jobNoteRoleLabel("tech")).toBe("Technician");
    expect(jobNoteRoleLabel("office")).toBe("Office");
    expect(jobNoteRoleLabel("")).toBe("");
    expect(EARLIER_NOTE_AUTHOR).toBe("Earlier note");
    expect(formatJobNoteTimestamp("2026-10-30T21:00:00.000Z")).toContain("Oct 30, 2026");
    expect(formatJobNoteTimestamp("2026-10-30T21:00:00.000Z")).toContain("2:00");
  });
});
