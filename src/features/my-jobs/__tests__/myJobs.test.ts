import { describe, expect, it } from "vitest";

import type { Job } from "@/features/jobs/types/job";
import { composeSidebarNav, composeTopLevelNav, SHELL_NAV_GROUPS, SHELL_TOP_LEVEL_ITEMS } from "@/components/layout/sidebarNav";
import { getNavItemsForRole } from "@/features/auth";
import { isShellRoute } from "@/lib/auth/routeAccess";
import { isRoleDeniedPath } from "@/lib/auth/shellAccess";
import { ROUTES } from "@/lib/routes";
import { todayInCompanyTimeZone } from "@/lib/timezone";

import {
  canOpenMyJobs,
  countDone,
  formatCardTime,
  isAssignedToMe,
  pickCurrentJobId,
  selectMyJobsToday,
  splitLocation,
  toMyJobCard,
} from "../utils/myJobs";

const TZ = "America/Los_Angeles";
const ME = { userId: "me", names: ["Pat Tech", "pat@example.com"] };

function job(partial: Partial<Job> & Pick<Job, "id">): Job {
  return {
    jobNumber: partial.id,
    title: partial.id,
    type: "Service",
    status: "Scheduled",
    priority: "Medium",
    customerId: null,
    customerName: "Example Customer",
    propertyId: null,
    propertyName: "Site",
    assignedTo: "",
    assignees: [{ id: "me", name: "Pat Tech" }],
    summary: "",
    location: "100 Sample Ave, Everett, WA, 98201",
    notes: "",
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
    scheduledFor: null,
    scheduledStartAt: null,
    scheduledEndAt: null,
    arrivalWindowStartAt: null,
    ...partial,
  } as Job;
}

describe("isAssignedToMe", () => {
  it("matches job_assignees, assigned_user_id, and legacy name only without assignees", () => {
    expect(isAssignedToMe(job({ id: "a" }), ME)).toBe(true);
    expect(isAssignedToMe(job({ id: "b", assignees: [{ id: "x", name: "Other" }] }), ME)).toBe(false);
    expect(isAssignedToMe(job({ id: "c", assignees: [{ id: "x", name: "Other" }] }), ME, new Set(["c"]))).toBe(true);
    expect(isAssignedToMe(job({ id: "d", assignees: [], assignedTo: " pat tech " }), ME)).toBe(true);
    expect(isAssignedToMe(job({ id: "e", assignees: [{ id: "x", name: "Other" }], assignedTo: "Pat Tech" }), ME)).toBe(false);
  });
});

describe("selectMyJobsToday", () => {
  const today = "2026-11-05";

  it("uses the Pacific day, not the UTC day (timezone edge)", () => {
    // 2026-11-06T06:30Z is 10:30 PM on Nov 5 in Los Angeles.
    const late = job({ id: "late", scheduledStartAt: "2026-11-06T06:30:00.000Z" });
    // 2026-11-05T07:30Z is 11:30 PM on Nov 4 in Los Angeles.
    const early = job({ id: "early", scheduledStartAt: "2026-11-05T07:30:00.000Z" });
    const ids = selectMyJobsToday({ jobs: [late, early], me: ME, today }).map((j) => j.id);
    expect(ids).toEqual(["late"]);
  });

  it("computes today in the company timezone across UTC midnight", () => {
    expect(todayInCompanyTimeZone(new Date("2026-11-06T05:00:00.000Z"), TZ)).toBe("2026-11-05");
  });

  it("sorts by start, keeps date-only jobs, drops cancelled and other techs' jobs", () => {
    const jobs = [
      job({ id: "j3", scheduledStartAt: "2026-11-05T21:00:00.000Z" }),
      job({ id: "j1", scheduledStartAt: "2026-11-05T15:30:00.000Z" }),
      job({ id: "dateonly", scheduledFor: "2026-11-05" }),
      job({ id: "cancel", status: "Cancelled", scheduledStartAt: "2026-11-05T16:00:00.000Z" }),
      job({ id: "other", assignees: [{ id: "x", name: "Other" }], scheduledStartAt: "2026-11-05T16:00:00.000Z" }),
      job({ id: "tomorrow", scheduledStartAt: "2026-11-06T17:00:00.000Z" }),
    ];
    expect(selectMyJobsToday({ jobs, me: ME, today }).map((j) => j.id)).toEqual(["dateonly", "j1", "j3"]);
  });

  it("includes an In Progress job started today even when scheduled yesterday", () => {
    const carry = job({ id: "carry", status: "In Progress", scheduledStartAt: "2026-11-04T16:00:00.000Z" });
    const doneYesterday = job({ id: "old", status: "Completed", scheduledStartAt: "2026-11-04T16:00:00.000Z" });
    const ids = selectMyJobsToday({ jobs: [carry, doneYesterday], me: ME, today, startedTodayJobIds: new Set(["carry", "old"]) }).map((j) => j.id);
    expect(ids).toEqual(["carry"]);
  });
});

describe("current job and progress", () => {
  it("picks In Progress first, else next not-completed", () => {
    expect(pickCurrentJobId([
      { id: "a", status: "Completed" },
      { id: "b", status: "Scheduled" },
      { id: "c", status: "In Progress" },
    ])).toBe("c");
    expect(pickCurrentJobId([
      { id: "a", status: "Completed" },
      { id: "b", status: "Scheduled" },
    ])).toBe("b");
    expect(pickCurrentJobId([{ id: "a", status: "Completed" }])).toBeNull();
    expect(countDone([{ status: "Completed" }, { status: "Scheduled" }])).toBe(1);
  });
});

describe("cards", () => {
  it("splits the stored location into street and city", () => {
    expect(splitLocation("1805 Village Green Drive, #26, Mill Creek, WA, 98012")).toEqual({ street: "1805 Village Green Drive, #26", city: "Mill Creek" });
    expect(splitLocation("15709 NE 62nd Ct, Redmond, WA, 98052-4844")).toEqual({ street: "15709 NE 62nd Ct", city: "Redmond" });
    expect(splitLocation("Shop")).toEqual({ street: "Shop", city: "" });
  });

  it("lists other assignees without the signed-in user", () => {
    const card = toMyJobCard(job({ id: "a", assignees: [{ id: "me", name: "Pat Tech" }, { id: "x", name: "Alex T." }] }), ME);
    expect(card.withNames).toEqual(["Alex T."]);
  });

  it("formats Pacific times and date-only jobs", () => {
    expect(formatCardTime("2026-11-05T15:30:00.000Z", TZ)).toBe("7:30 AM");
    expect(formatCardTime("2026-11-05", TZ)).toBe("Any time");
  });
});

describe("My Jobs access and nav", () => {
  it("is open to every internal role and never to portal", () => {
    for (const role of ["owner", "manager", "dispatch", "tech", "office", "sales"]) {
      expect(canOpenMyJobs(role)).toBe(true);
      expect(isRoleDeniedPath(role, ROUTES.MY_JOBS)).toBe(false);
    }
    expect(canOpenMyJobs("portal")).toBe(false);
    expect(canOpenMyJobs(null)).toBe(false);
  });

  it("requires a session", () => {
    expect(isShellRoute(ROUTES.MY_JOBS)).toBe(true);
  });

  it("is a standalone top-level entry, not inside any group", () => {
    expect(SHELL_TOP_LEVEL_ITEMS.map((item) => item.href)).toEqual([ROUTES.MY_JOBS]);
    const inGroups = SHELL_NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));
    expect(inGroups).not.toContain(ROUTES.MY_JOBS);
    for (const role of ["owner", "manager", "dispatch", "tech", "office", "sales"]) {
      expect(composeTopLevelNav(role).map((item) => item.href)).toEqual([ROUTES.MY_JOBS]);
      expect(composeSidebarNav({ role }).flatMap((g) => g.items).some((i) => i.href === ROUTES.MY_JOBS)).toBe(false);
    }
  });

  it("never shows My Jobs to portal or unknown roles", () => {
    expect(composeTopLevelNav("portal")).toEqual([]);
    expect(composeTopLevelNav(null)).toEqual([]);
    expect(composeTopLevelNav("nobody")).toEqual([]);
    expect(getNavItemsForRole("portal", SHELL_NAV_GROUPS)).toEqual([]);
  });
});
