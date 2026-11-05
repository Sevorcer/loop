import { describe, expect, it } from "vitest";

import {
  DAILY_PLANS_UPCOMING_DAYS,
  addDays,
  getScheduledTodayJobs,
  getTodayDate,
  getUpcomingJobs,
} from "../utils/planUtils";
import type { Job } from "@/features/jobs/types/job";

function job(partial: Partial<Job> & Pick<Job, "id" | "scheduledFor">): Job {
  return {
    jobNumber: partial.id,
    title: partial.id,
    type: "Service",
    status: "Scheduled",
    priority: "Medium",
    customerId: null,
    customerName: "",
    propertyId: null,
    propertyName: "",
    assignedTo: "",
    assignees: [],
    summary: "",
    location: "",
    notes: "",
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
    scheduledStartAt: null,
    scheduledEndAt: null,
    ...partial,
  } as Job;
}

describe("Daily Plans date window", () => {
  it("keeps a 14-day upcoming window constant for the ranged API", () => {
    expect(DAILY_PLANS_UPCOMING_DAYS).toBe(14);
    const today = "2026-11-04";
    expect(addDays(today, DAILY_PLANS_UPCOMING_DAYS)).toBe("2026-11-18");
  });

  it("splits today vs upcoming from a ranged payload (not the full history)", () => {
    const today = getTodayDate();
    const jobs = [
      job({ id: "past", scheduledFor: addDays(today, -30) }),
      job({ id: "today", scheduledFor: today }),
      job({ id: "soon", scheduledFor: addDays(today, 3) }),
      job({ id: "later", scheduledFor: addDays(today, 20) }),
    ];
    // A ranged API would not include "past"; the helpers still classify correctly.
    expect(getScheduledTodayJobs(jobs).map((j) => j.id)).toEqual(["today"]);
    expect(getUpcomingJobs(jobs).map((j) => j.id)).toEqual(["soon", "later"]);
  });
});
