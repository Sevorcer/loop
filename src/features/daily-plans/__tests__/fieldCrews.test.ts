import { describe, expect, it } from "vitest";

import { buildDailyCrewRoster } from "../data/fieldCrews";
import { buildPlannedJob } from "../utils/planUtils";
import type { Job } from "@/features/jobs/types/job";

describe("daily crew roster", () => {
  it("returns empty roster when no one is assigned today", () => {
    const roster = buildDailyCrewRoster({ crews: [], assignedNames: ["", "  "] });
    expect(roster.crewGroups).toEqual([]);
    expect(roster.floaters).toEqual([]);
    expect(roster.allProfiles).toEqual([]);
  });

  it("groups an assigned person under their crew record", () => {
    const roster = buildDailyCrewRoster({
      crews: [
        {
          id: "crew-1",
          name: "Install",
          lead_installer: "Alex Kim",
          members: ["Sam Ortiz"],
          certifications: ["EPA"],
          availability: "partially_available",
          truck_name: "Van 2",
        },
      ],
      assignedNames: ["Alex Kim"],
    });

    expect(roster.crewGroups).toHaveLength(1);
    expect(roster.crewGroups[0].crew).toMatchObject({
      technician: "Alex Kim",
      helper: "Sam Ortiz",
      truckName: "Van 2",
      availability: "half day",
    });
    expect(roster.crewGroups[0].assignedMembers).toEqual(["Alex Kim"]);
    expect(roster.floaters).toEqual([]);
  });

  it("places assigned person with no crew in floaters group", () => {
    const roster = buildDailyCrewRoster({
      crews: [],
      assignedNames: ["Casey Ng"],
    });

    expect(roster.crewGroups).toEqual([]);
    expect(roster.floaters).toEqual(["Casey Ng"]);
    // Floaters have no invented truck, availability, or departure fields
    const profile = roster.allProfiles.find((p) => p.technician === "Casey Ng");
    expect(profile).toBeDefined();
    expect(profile!.truckName).toBe("—");
    expect(profile!.departureTime).toBe("—");
  });

  it("people not assigned today do not appear", () => {
    const roster = buildDailyCrewRoster({
      crews: [
        {
          id: "crew-1",
          name: "Install",
          lead_installer: "Alex Kim",
          members: ["Sam Ortiz"],
          certifications: ["EPA"],
          availability: "available",
          truck_name: "Van 2",
        },
      ],
      assignedNames: [], // no one assigned today
    });

    expect(roster.crewGroups).toEqual([]);
    expect(roster.floaters).toEqual([]);
    expect(roster.allProfiles).toEqual([]);
  });

  it("empty day produces empty panel", () => {
    const roster = buildDailyCrewRoster({ crews: [], assignedNames: [] });
    expect(roster.crewGroups).toEqual([]);
    expect(roster.floaters).toEqual([]);
    expect(roster.allProfiles).toEqual([]);
  });

  it("crew member assigned today appears under their crew, not as a floater", () => {
    const roster = buildDailyCrewRoster({
      crews: [
        {
          id: "crew-1",
          name: "Alpha Crew",
          lead_installer: "Alex Kim",
          members: ["Sam Ortiz"],
          certifications: [],
          availability: "available",
          truck_name: "Van 1",
        },
      ],
      assignedNames: ["Sam Ortiz", "Jordan Lee"],
    });

    // Sam is a member of crew-1 so appears under the crew
    expect(roster.crewGroups).toHaveLength(1);
    expect(roster.crewGroups[0].assignedMembers).toContain("Sam Ortiz");
    // Jordan has no crew so is a floater
    expect(roster.floaters).toEqual(["Jordan Lee"]);
  });
});

describe("honest job plans", () => {
  it("does not invent permits or materials for a database job", () => {
    const job = {
      id: "8b1c1c4e-2d5a-4e1b-9c1a-111111111111",
      jobNumber: "JOB-3001",
      title: "No cool",
      type: "Service",
      status: "Scheduled",
      priority: "Medium",
      customerName: "Northwind",
      propertyName: "Warehouse",
      assignedTo: "",
      scheduledFor: "2026-10-29",
      summary: "",
      location: "Tacoma",
      notes: "",
    } satisfies Job;

    const planned = buildPlannedJob(job);
    expect(planned.planning.permitRequired).toBe(false);
    expect(planned.planning.readinessChecks).toEqual([]);
    expect(planned.planning.materialChecklist).toEqual([]);
    expect(planned.planning.estimatedHours).toBe(0);
    expect(planned.readiness.blockers).toContain("Crew assignment required");
    expect(planned.readiness.warnings).not.toContain("Materials not staged");
  });
});
