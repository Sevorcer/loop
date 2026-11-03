/**
 * Edit Job — prefill round-trip.
 *
 * The Edit Job form opens prefilled from a stored Job, then Save sends those
 * values to PATCH /api/jobs/[id] action:"update" (forwarding to updateJob is
 * covered in src/app/api/__tests__/jobs-lifecycle-contract.test.ts).
 *
 * These tests lock in the prefill side of the round-trip for the fields B4
 * cares about: closeout mode and BOTH schedule dates (start + end). The
 * date-prefill mechanics are also exercised in scheduling-regression.test.ts;
 * here we assert closeout mode and the start/end pair travel together so a
 * saved edit cannot silently drop either one.
 */

import { describe, expect, it } from "vitest";

import { editJobIdentityValues } from "@/features/jobs/utils/editJobInitialValues";
import { jobToFormScheduling } from "@/features/jobs/components/JobForm";

const DATETIME_LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

describe("Edit Job prefill — closeout mode", () => {
  it("carries a stored 'visit' closeout mode onto the form", () => {
    const values = editJobIdentityValues({
      title: "Inspection final",
      customerName: "Acme Corp",
      customerId: "cus-1",
      propertyName: "Acme HQ",
      propertyId: "prop-1",
      assignedTo: "Tech A",
      assignees: [{ id: "tech-1" }],
      type: "Inspection",
      priority: "Medium",
      closeoutMode: "visit",
      location: "123 Main St",
      summary: "Final walk-through",
      notes: "",
    });

    expect(values.closeoutMode).toBe("visit");
    // Identity ids must ride along so Save updates (not re-creates) the job.
    expect(values.customerId).toBe("cus-1");
    expect(values.propertyId).toBe("prop-1");
    expect(values.assigneeIds).toEqual(["tech-1"]);
  });

  it("defaults closeout mode to 'full' for a legacy job with none stored", () => {
    const values = editJobIdentityValues({
      title: "Service call",
      customerName: "Acme Corp",
      propertyName: "Acme HQ",
      assignedTo: "",
      type: "Service",
      priority: "Low",
      location: "Roof",
      summary: "No cool",
      notes: "",
    });

    expect(values.closeoutMode).toBe("full");
  });
});

describe("Edit Job prefill — schedule start + end travel together", () => {
  it("prefills BOTH scheduled start and scheduled end from a PR3C job", () => {
    const scheduling = jobToFormScheduling({
      scheduledStartAt: "2026-11-02T18:00:00.000Z",
      scheduledEndAt: "2026-11-05T02:00:00.000Z",
      scheduledFor: "2026-11-02",
    });

    expect(scheduling.scheduledStartAt).toMatch(DATETIME_LOCAL);
    expect(scheduling.scheduledEndAt).toMatch(DATETIME_LOCAL);
  });

  it("leaves scheduled end empty (not fabricated) when the job has no end", () => {
    const scheduling = jobToFormScheduling({
      scheduledStartAt: "2026-11-02T18:00:00.000Z",
      scheduledEndAt: null,
      scheduledFor: "2026-11-02",
    });

    expect(scheduling.scheduledStartAt).toMatch(DATETIME_LOCAL);
    expect(scheduling.scheduledEndAt).toBe("");
  });
});
