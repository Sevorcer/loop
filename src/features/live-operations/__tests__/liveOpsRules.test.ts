import { describe, expect, it } from "vitest";

import type { Job } from "@/features/jobs/types/job";
import {
  LIVE_OPS_THRESHOLD_MINUTES,
  type LiveJob,
  type LiveOpsInput,
} from "../types/liveOps";
import {
  buildLiveOpsSnapshot,
  companyDayBounds,
  deriveFeed,
  deriveHealth,
  deriveProgress,
  deriveTechCards,
  findAssignedOnTimeOff,
  findDoubleBooked,
  findLateStarts,
  findOnHoldToday,
  findRunningLong,
  findStuckInProgress,
  findUnassigned,
  jobStage,
} from "../utils/liveOpsUtils";

// Fixture data only — made-up job numbers and people.
const TZ = "America/Los_Angeles";
const DATE = "2026-11-05";
/** 10:30 AM Pacific (PST, UTC-8) */
const NOW = "2026-11-05T18:30:00.000Z";
const NOW_MS = new Date(NOW).getTime();

/** Pacific wall clock on DATE → ISO instant (PST = UTC-8). */
function pt(hhmm: string, date = DATE): string {
  const [h, m] = hhmm.split(":").map(Number);
  const [y, mo, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h + 8, m)).toISOString();
}

const ANA = { id: "u-ana", name: "Ana Tech" };
const BEN = { id: "u-ben", name: "Ben Tech" };

let seq = 0;
function job(overrides: Partial<LiveJob> = {}): LiveJob {
  seq += 1;
  const id = overrides.id ?? `job-${seq}`;
  const base: LiveJob = {
    id,
    jobNumber: overrides.jobNumber ?? `JOB-${1000 + seq}`,
    title: "Fixture job",
    type: "Service",
    status: "Scheduled",
    customerName: "Fixture Customer",
    propertyName: "Fixture Site",
    scheduledFor: DATE,
    scheduledStartAt: pt("09:00"),
    scheduledEndAt: pt("10:00"),
    arrivalWindowStartAt: null,
    arrivalWindowEndAt: null,
    enRouteAt: null,
    assignees: [ANA],
    job: {} as Job,
    ...overrides,
  };
  base.job = {
    id: base.id,
    jobNumber: base.jobNumber,
    title: base.title,
    type: "Service",
    status: base.status,
    priority: "Medium",
    customerName: base.customerName,
    propertyName: base.propertyName,
    assignedTo: "",
    scheduledFor: base.scheduledFor,
    summary: "",
    location: "",
    notes: "",
  };
  return base;
}

function input(overrides: Partial<LiveOpsInput> = {}): LiveOpsInput {
  return {
    date: DATE,
    now: NOW,
    jobs: [],
    activity: [],
    notes: [],
    timeOff: [],
    people: [
      { ...ANA, role: "tech" },
      { ...BEN, role: "tech" },
      { id: "u-office", name: "Olive Office", role: "office" },
    ],
    dayStartedAt: null,
    ...overrides,
  };
}

describe("threshold", () => {
  it("is 60 minutes (Collin, 2026-11-05)", () => {
    expect(LIVE_OPS_THRESHOLD_MINUTES).toBe(60);
  });
});

describe("company day bounds", () => {
  it("covers Pacific midnight to midnight", () => {
    const day = companyDayBounds(DATE, TZ);
    expect(new Date(day.start).toISOString()).toBe("2026-11-05T08:00:00.000Z");
    expect(new Date(day.end).toISOString()).toBe("2026-11-06T08:00:00.000Z");
  });
});

describe("late to start (60 min)", () => {
  it("flags a Scheduled job whose start passed 60+ minutes ago with nobody on the way", () => {
    const late = job({ scheduledStartAt: pt("08:00") }); // 150 min late
    const items = findLateStarts([late], DATE, NOW_MS);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: "late_start", severity: "critical", minutes: 150 });
  });

  it("fires at exactly 60 minutes but not at 59", () => {
    expect(findLateStarts([job({ scheduledStartAt: pt("09:30") })], DATE, NOW_MS)).toHaveLength(1);
    expect(findLateStarts([job({ scheduledStartAt: pt("09:31") })], DATE, NOW_MS)).toHaveLength(0);
  });

  it("does not flag once On The Way was tapped, or the job started", () => {
    expect(findLateStarts([job({ scheduledStartAt: pt("08:00"), enRouteAt: pt("08:50") })], DATE, NOW_MS)).toHaveLength(0);
    expect(findLateStarts([job({ scheduledStartAt: pt("08:00"), status: "In Progress" })], DATE, NOW_MS)).toHaveLength(0);
  });

  it("falls back to the arrival window start when there is no committed start", () => {
    const windowOnly = job({ scheduledStartAt: null, arrivalWindowStartAt: pt("08:00") });
    expect(findLateStarts([windowOnly], DATE, NOW_MS)).toHaveLength(1);
  });

  it("ignores jobs from other days and jobs with no time", () => {
    expect(findLateStarts([job({ scheduledFor: "2026-11-04", scheduledStartAt: pt("08:00", "2026-11-04") })], DATE, NOW_MS)).toHaveLength(0);
    expect(findLateStarts([job({ scheduledStartAt: null })], DATE, NOW_MS)).toHaveLength(0);
  });
});

describe("running long (60 min)", () => {
  it("flags today's In Progress job 60+ minutes past its scheduled end", () => {
    const items = findRunningLong([job({ status: "In Progress", scheduledEndAt: pt("09:00") })], DATE, NOW_MS);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: "running_long", severity: "warning", minutes: 90 });
  });

  it("does not flag under 60 minutes over, or jobs that are not In Progress", () => {
    expect(findRunningLong([job({ status: "In Progress", scheduledEndAt: pt("10:00") })], DATE, NOW_MS)).toHaveLength(0);
    expect(findRunningLong([job({ status: "Scheduled", scheduledEndAt: pt("08:00") })], DATE, NOW_MS)).toHaveLength(0);
  });

  it("leaves carried-over jobs to the stuck rule", () => {
    const carried = job({ status: "In Progress", scheduledFor: "2026-11-03", scheduledEndAt: pt("12:00", "2026-11-03") });
    expect(findRunningLong([carried], DATE, NOW_MS)).toHaveLength(0);
    expect(findStuckInProgress([carried], DATE)).toHaveLength(1);
  });
});

describe("stuck In Progress from an earlier day", () => {
  it("flags In Progress jobs scheduled before today", () => {
    const items = findStuckInProgress([job({ status: "In Progress", scheduledFor: "2026-10-28" })], DATE);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: "stuck_in_progress", severity: "warning" });
    expect(items[0].detail).toContain("2026-10-28");
  });

  it("does not flag today's In Progress jobs or old Scheduled jobs", () => {
    expect(findStuckInProgress([job({ status: "In Progress" })], DATE)).toHaveLength(0);
    expect(findStuckInProgress([job({ status: "Scheduled", scheduledFor: "2026-10-28" })], DATE)).toHaveLength(0);
  });
});

describe("double-booked", () => {
  it("flags one person on two overlapping open jobs today", () => {
    const a = job({ scheduledStartAt: pt("09:00"), scheduledEndAt: pt("11:00") });
    const b = job({ scheduledStartAt: pt("10:00"), scheduledEndAt: pt("12:00") });
    const items = findDoubleBooked([a, b], DATE);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: "double_booked", severity: "critical", personId: ANA.id });
    expect(items[0].detail).toContain(a.jobNumber);
    expect(items[0].detail).toContain(b.jobNumber);
  });

  it("does not flag back-to-back jobs, different people, or finished jobs", () => {
    const first = job({ scheduledStartAt: pt("09:00"), scheduledEndAt: pt("10:00") });
    const next = job({ scheduledStartAt: pt("10:00"), scheduledEndAt: pt("11:00") });
    expect(findDoubleBooked([first, next], DATE)).toHaveLength(0);

    const other = job({ scheduledStartAt: pt("09:30"), scheduledEndAt: pt("10:30"), assignees: [BEN] });
    expect(findDoubleBooked([first, other], DATE)).toHaveLength(0);

    const done = job({ status: "Completed", scheduledStartAt: pt("09:30"), scheduledEndAt: pt("10:30") });
    expect(findDoubleBooked([first, done], DATE)).toHaveLength(0);
  });

  it("treats a job with no end time as one hour long", () => {
    const noEnd = job({ scheduledStartAt: pt("09:00"), scheduledEndAt: null });
    const overlapping = job({ scheduledStartAt: pt("09:45"), scheduledEndAt: pt("10:30") });
    const after = job({ scheduledStartAt: pt("10:00"), scheduledEndAt: pt("10:30") });
    expect(findDoubleBooked([noEnd, overlapping], DATE)).toHaveLength(1);
    expect(findDoubleBooked([noEnd, after], DATE)).toHaveLength(0);
  });

  it("flags each person separately on a shared pair", () => {
    const a = job({ assignees: [ANA, BEN], scheduledStartAt: pt("09:00"), scheduledEndAt: pt("11:00") });
    const b = job({ assignees: [ANA, BEN], scheduledStartAt: pt("10:00"), scheduledEndAt: pt("12:00") });
    expect(findDoubleBooked([a, b], DATE).map((entry) => entry.personId).sort()).toEqual([ANA.id, BEN.id]);
  });
});

describe("assigned while on time off", () => {
  it("flags a person whose time off overlaps the job", () => {
    const items = findAssignedOnTimeOff(
      [job({ scheduledStartAt: pt("10:00"), scheduledEndAt: pt("11:00") })],
      [{ userId: ANA.id, startsAt: pt("08:00"), endsAt: pt("17:00") }],
      DATE,
      TZ,
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: "assigned_on_time_off", severity: "critical", personId: ANA.id });
  });

  it("does not flag time off at a different time, another person, or another day", () => {
    const morning = job({ scheduledStartAt: pt("09:00"), scheduledEndAt: pt("10:00") });
    expect(findAssignedOnTimeOff([morning], [{ userId: ANA.id, startsAt: pt("13:00"), endsAt: pt("17:00") }], DATE, TZ)).toHaveLength(0);
    expect(findAssignedOnTimeOff([morning], [{ userId: BEN.id, startsAt: pt("08:00"), endsAt: pt("17:00") }], DATE, TZ)).toHaveLength(0);
    expect(
      findAssignedOnTimeOff(
        [morning],
        [{ userId: ANA.id, startsAt: pt("08:00", "2026-11-04"), endsAt: pt("17:00", "2026-11-04") }],
        DATE,
        TZ,
      ),
    ).toHaveLength(0);
  });

  it("checks an untimed job against the whole day", () => {
    const untimed = job({ scheduledStartAt: null, scheduledEndAt: null });
    expect(findAssignedOnTimeOff([untimed], [{ userId: ANA.id, startsAt: pt("13:00"), endsAt: pt("17:00") }], DATE, TZ)).toHaveLength(1);
  });

  it("ignores finished jobs", () => {
    const done = job({ status: "Completed", scheduledStartAt: pt("10:00"), scheduledEndAt: pt("11:00") });
    expect(findAssignedOnTimeOff([done], [{ userId: ANA.id, startsAt: pt("08:00"), endsAt: pt("17:00") }], DATE, TZ)).toHaveLength(0);
  });
});

describe("unassigned and on hold", () => {
  it("flags open jobs today with nobody on them", () => {
    expect(findUnassigned([job({ assignees: [] })], DATE)).toHaveLength(1);
    expect(findUnassigned([job({ assignees: [], status: "Completed" })], DATE)).toHaveLength(0);
    expect(findUnassigned([job({ assignees: [], scheduledFor: "2026-11-06" })], DATE)).toHaveLength(0);
  });

  it("flags today's On Hold jobs", () => {
    expect(findOnHoldToday([job({ status: "On Hold" })], DATE)).toHaveLength(1);
    expect(findOnHoldToday([job({ status: "On Hold", scheduledFor: "2026-11-04" })], DATE)).toHaveLength(0);
  });
});

describe("health", () => {
  it("summarizes attention items", () => {
    expect(deriveHealth([]).state).toBe("healthy");
    const warning = findUnassigned([job({ assignees: [] })], DATE);
    expect(deriveHealth(warning).state).toBe("minor_issues");
    const critical = findLateStarts([job({ scheduledStartAt: pt("08:00") })], DATE, NOW_MS);
    expect(deriveHealth(critical).state).toBe("needs_attention");
    expect(deriveHealth([...critical, ...critical]).state).toBe("critical");
  });
});

describe("stages and day progress", () => {
  it("maps status plus On The Way to a stage", () => {
    expect(jobStage(job())).toBe("scheduled");
    expect(jobStage(job({ enRouteAt: pt("08:40") }))).toBe("on_the_way");
    expect(jobStage(job({ status: "In Progress" }))).toBe("in_progress");
    expect(jobStage(job({ status: "Completed" }))).toBe("completed");
    expect(jobStage(job({ status: "On Hold" }))).toBe("on_hold");
  });

  it("counts only today's jobs", () => {
    const progress = deriveProgress(
      [
        job(),
        job({ enRouteAt: pt("08:40") }),
        job({ status: "In Progress" }),
        job({ status: "Completed" }),
        job({ status: "On Hold" }),
        job({ status: "In Progress", scheduledFor: "2026-11-02" }),
      ],
      DATE,
    );
    expect(progress).toEqual({ total: 5, scheduled: 1, onTheWay: 1, inProgress: 1, completed: 1, onHold: 1 });
  });
});

describe("tech board", () => {
  it("shows current job, next job, and done counts per tech", () => {
    const done = job({ status: "Completed", scheduledStartAt: pt("07:00"), scheduledEndAt: pt("08:00") });
    const current = job({ id: "job-current", status: "In Progress", scheduledStartAt: pt("09:00"), scheduledEndAt: pt("12:00") });
    const next = job({ scheduledStartAt: pt("13:00"), scheduledEndAt: pt("14:00") });
    const cards = deriveTechCards(
      input({
        jobs: [done, current, next],
        activity: [{ id: "a1", jobId: "job-current", type: "status", title: "Job started", createdAt: pt("09:05"), actorId: ANA.id }],
      }),
      [],
    );
    const ana = cards.find((card) => card.personId === ANA.id)!;
    expect(ana.state).toBe("on_job");
    expect(ana.currentJob?.id).toBe("job-current");
    expect(ana.currentJob?.at).toBe(pt("09:05"));
    expect(ana.nextJob?.id).toBe(next.id);
    expect(ana.jobsToday).toBe(3);
    expect(ana.jobsDone).toBe(1);
  });

  it("lists techs with no jobs as free, and people off today as off", () => {
    const cards = deriveTechCards(
      input({ timeOff: [{ userId: BEN.id, startsAt: pt("00:00"), endsAt: pt("23:59") }] }),
      [],
    );
    expect(cards.find((card) => card.personId === ANA.id)?.state).toBe("free");
    expect(cards.find((card) => card.personId === BEN.id)?.state).toBe("off_today");
    expect(cards.some((card) => card.personId === "u-office")).toBe(false);
  });

  it("shows On The Way and a shared job on every assigned tech's card", () => {
    const shared = job({ assignees: [ANA, BEN], enRouteAt: pt("10:10"), scheduledStartAt: pt("10:30") });
    const cards = deriveTechCards(input({ jobs: [shared] }), []);
    expect(cards.filter((card) => card.state === "on_the_way").map((card) => card.personId).sort()).toEqual([ANA.id, BEN.id]);
  });

  it("puts techs with attention items first", () => {
    const late = job({ assignees: [BEN], scheduledStartAt: pt("08:00") });
    const fine = job({ assignees: [ANA], status: "In Progress" });
    const snapshot = buildLiveOpsSnapshot(input({ jobs: [late, fine] }), TZ);
    expect(snapshot.techs[0].personId).toBe(BEN.id);
    expect(snapshot.techs[0].attentionKinds).toContain("late_start");
  });
});

describe("activity feed", () => {
  it("shows today's events newest first with plain labels and never raw free text", () => {
    const j = job({ id: "job-feed" });
    const feed = deriveFeed(
      input({
        jobs: [j],
        activity: [
          { id: "a1", jobId: "job-feed", type: "status", title: "Job started", createdAt: pt("09:00"), actorId: ANA.id },
          { id: "a2", jobId: "job-feed", type: "file", title: "IMG_1234.jpg uploaded", createdAt: pt("09:30"), actorId: ANA.id },
          { id: "a3", jobId: "job-feed", type: "status", title: "Something custom", createdAt: pt("09:40"), actorId: null },
          { id: "a4", jobId: "job-feed", type: "status", title: "Job started", createdAt: pt("09:00", "2026-11-04"), actorId: ANA.id },
        ],
        notes: [{ id: "n1", jobId: "job-feed", createdAt: pt("10:00"), authorId: "u-office" }],
      }),
      TZ,
    );
    expect(feed.map((entry) => entry.label)).toEqual(["Note added", "Status updated", "Photo or file added", "Job started"]);
    expect(feed[0].actorName).toBe("Olive Office");
    expect(feed.some((entry) => entry.label.includes("IMG"))).toBe(false);
  });
});

describe("snapshot", () => {
  it("carries Today's jobs (start order) and every In Progress job for the moved lists", () => {
    const later = job({ id: "later", scheduledStartAt: pt("13:00") });
    const earlier = job({ id: "earlier", scheduledStartAt: pt("08:00"), status: "In Progress" });
    const carried = job({ id: "carried", status: "In Progress", scheduledFor: "2026-11-01" });
    const cancelled = job({ id: "cancelled", status: "Cancelled" });
    const snapshot = buildLiveOpsSnapshot(input({ jobs: [later, earlier, carried, cancelled] }), TZ);
    expect(snapshot.todayJobs.map((j) => j.id)).toEqual(["earlier", "later"]);
    expect(snapshot.inProgressJobs.map((j) => j.id).sort()).toEqual(["carried", "earlier"]);
    expect(snapshot.hero.jobsRunning).toBe(2);
    expect(snapshot.thresholdMinutes).toBe(60);
    expect(snapshot.attention.map((entry) => entry.kind)).toContain("stuck_in_progress");
  });
});
