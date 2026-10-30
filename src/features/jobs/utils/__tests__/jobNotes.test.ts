import { describe, expect, it } from "vitest";

import type { JobActivity } from "@/features/jobs/types/jobActivity";
import type { JobNote } from "@/features/jobs/types/jobNote";
import {
  EARLIER_NOTE_AUTHOR,
  JOB_NOTE_ACTIVITY_TITLE,
  JOB_NOTE_SAVED_TOAST,
  LEGACY_NOTE_UNSAVED_TEXT,
  activityWithJobNotes,
  displayJobNotes,
  formatJobNoteTimestamp,
  jobNoteByline,
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

  it("keeps the migrated column note in the history and labels it as earlier", () => {
    const notes: JobNote[] = [
      {
        id: "imported",
        jobId: "job-1018",
        body: "Retest note 10/30",
        authorId: "tech-1",
        authorName: "QA Test Tech",
        authorRole: "tech",
        createdAt: "2026-10-30T16:14:37.884Z",
      },
      {
        id: "owner",
        jobId: "job-1018",
        body: "Office retest note 10/30",
        authorId: "owner-1",
        authorName: "Collin",
        authorRole: "owner",
        createdAt: "2026-10-30T18:01:56.999Z",
      },
    ];

    const shown = displayJobNotes(notes, "Retest note 10/30");
    expect(shown.map((note) => note.body)).toEqual([
      "Office retest note 10/30",
      "Retest note 10/30",
    ]);
    expect(shown.find((note) => note.id === "imported")?.imported).toBe(true);
    expect(shown.find((note) => note.id === "owner")?.imported).toBe(false);
  });

  it("replaces a placeholder timeline event with the imported note text", () => {
    const activity: JobActivity[] = [
      {
        id: "old",
        jobId: "job-1018",
        type: "note",
        title: "Notes updated",
        description: "Job notes updated.",
        timestamp: "2026-10-30T16:14:37.884Z",
      },
      {
        id: "new",
        jobId: "job-1018",
        type: "note",
        title: "Note added",
        description: "Collin · Owner\nOffice retest note 10/30",
        timestamp: "2026-10-30T18:01:57.353Z",
      },
    ];
    const notes = displayJobNotes(
      [
        {
          id: "imported",
          jobId: "job-1018",
          body: "Retest note 10/30",
          authorId: null,
          authorName: "QA Test Tech",
          authorRole: "tech",
          createdAt: "2026-10-30T16:14:37.884Z",
        },
        {
          id: "owner",
          jobId: "job-1018",
          body: "Office retest note 10/30",
          authorId: "owner-1",
          authorName: "Collin",
          authorRole: "owner",
          createdAt: "2026-10-30T18:01:56.999Z",
        },
      ],
      "Retest note 10/30",
    );

    const timeline = activityWithJobNotes(activity, notes);
    expect(timeline).toHaveLength(2);
    expect(timeline.find((item) => item.id === "old")).toMatchObject({
      title: "Earlier note",
      description: "Retest note 10/30",
      timestamp: "2026-10-30T16:14:37.884Z",
    });
    expect(timeline.find((item) => item.id === "new")?.description).toContain(
      "Office retest note 10/30",
    );
  });

  it("labels the migrated note from its placeholder time, even when a later edit owns the column", () => {
    const notes: JobNote[] = [
      {
        id: "imported",
        jobId: "job-1018",
        body: "Retest note 10/30",
        authorId: "tech-1",
        authorName: "QA Test Tech",
        authorRole: "tech",
        createdAt: "2026-10-30T16:14:37.884662+00:00",
      },
      {
        id: "owner",
        jobId: "job-1018",
        body: "Office retest note 10/30",
        authorId: "owner-1",
        authorName: "Collin",
        authorRole: "owner",
        createdAt: "2026-10-30T18:01:56.999251+00:00",
      },
      {
        id: "tech",
        jobId: "job-1018",
        body: "Tech retest note 10/30",
        authorId: "tech-1",
        authorName: "QA Test Tech",
        authorRole: "tech",
        createdAt: "2026-10-30T18:02:32.221257+00:00",
      },
    ];
    const activity: JobActivity[] = [
      {
        id: "lost",
        jobId: "job-1018",
        type: "note",
        title: "Notes updated",
        description: "Job notes updated.",
        timestamp: "2026-10-30T15:31:36.579442+00",
      },
      {
        id: "kept",
        jobId: "job-1018",
        type: "note",
        title: "Notes updated",
        description: "Job notes updated.",
        timestamp: "2026-10-30T16:14:37.884662+00",
      },
      {
        id: "office",
        jobId: "job-1018",
        type: "note",
        title: "Note added",
        description: "Collin · Owner\nOffice retest note 10/30",
        timestamp: "2026-10-30T18:01:57.353205+00:00",
      },
      {
        id: "tech-event",
        jobId: "job-1018",
        type: "note",
        title: "Note added",
        description: "QA Test Tech · Technician\nTech retest note 10/30",
        timestamp: "2026-10-30T18:02:32.443804+00:00",
      },
    ];

    const shown = displayJobNotes(notes, "Office retest note 10/30", activity);
    const imported = shown.find((note) => note.id === "imported");
    expect(imported?.imported).toBe(true);
    expect(jobNoteByline(imported!)).toMatch(/^Earlier note/);
    expect(jobNoteByline(imported!)).not.toContain("QA Test Tech");
    expect(shown.find((note) => note.id === "owner")?.imported).toBe(false);
    expect(shown.find((note) => note.id === "tech")?.imported).toBe(false);

    const timeline = activityWithJobNotes(activity, shown);
    expect(timeline).toHaveLength(activity.length);
    expect(timeline.find((item) => item.id === "kept")).toMatchObject({
      title: "Earlier note",
      description: "Retest note 10/30",
      timestamp: "2026-10-30T16:14:37.884662+00",
    });
    expect(timeline.find((item) => item.id === "lost")).toMatchObject({
      title: "Notes edited",
      description: LEGACY_NOTE_UNSAVED_TEXT,
    });
    expect(timeline.find((item) => item.id === "office")?.description).toContain(
      "Office retest note 10/30",
    );
    expect(timeline.find((item) => item.id === "tech-event")?.description).toContain(
      "Tech retest note 10/30",
    );
    expect(timeline.some((item) => item.id.startsWith("note-history-"))).toBe(false);
  });

  it("does not label a new note just because it matches the notes column", () => {
    const notes: JobNote[] = [
      {
        id: "new",
        jobId: "job-1",
        body: "Arrived on site.",
        authorId: "owner-1",
        authorName: "Collin",
        authorRole: "owner",
        createdAt: "2026-10-30T18:01:56.999Z",
      },
    ];
    const activity: JobActivity[] = [
      {
        id: "added",
        jobId: "job-1",
        type: "note",
        title: "Note added",
        description: "Collin · Owner\nArrived on site.",
        timestamp: "2026-10-30T18:01:57.353Z",
      },
    ];

    const shown = displayJobNotes(notes, "Arrived on site.", activity);
    expect(shown[0]?.imported).toBe(false);
    expect(jobNoteByline(shown[0]!)).toContain("Collin");
    expect(activityWithJobNotes(activity, shown)[0]?.description).toContain("Arrived on site.");
  });

  it("still labels a preserved note that was stored under the earlier-note name", () => {
    const shown = displayJobNotes(
      [
        {
          id: "preserved",
          jobId: "job-1",
          body: "Gate code is 1234.",
          authorId: null,
          authorName: EARLIER_NOTE_AUTHOR,
          authorRole: "",
          createdAt: "2026-10-30T18:00:00.000Z",
        },
      ],
      "Gate code is 1234.",
    );
    expect(shown[0]?.imported).toBe(true);
    expect(jobNoteByline(shown[0]!)).toMatch(/^Earlier note/);
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
