import { describe, expect, it } from "vitest";

import { buildFieldCrews } from "../data/fieldCrews";
import { buildPlannedJob } from "../utils/planUtils";
import type { Job } from "@/features/jobs/types/job";

describe("field crews", () => {
  it("returns an empty roster when nothing is on file", () => {
    expect(buildFieldCrews({ crews: [], technicians: [], assignedNames: ["", "  "] })).toEqual([]);
  });

  it("uses crew records and does not invent helpers or truck checks", () => {
    const [crew] = buildFieldCrews({
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
      technicians: [{ id: "tech-1", full_name: "Alex Kim", email: "alex@example.com" }],
      assignedNames: ["Jordan Lee"],
    });

    expect(crew).toMatchObject({
      technician: "Alex Kim",
      helper: "Sam Ortiz",
      truckName: "Van 2",
      availability: "half day",
      truckChecks: [],
      departureTime: "—",
    });
  });

  it("adds technicians and assigned names that are not already a crew", () => {
    const crews = buildFieldCrews({
      crews: [],
      technicians: [{ id: "tech-1", full_name: "Priya Shah", email: null }],
      assignedNames: ["Casey Ng"],
    });

    expect(crews.map((crew) => crew.technician)).toEqual(["Casey Ng", "Priya Shah"]);
    expect(crews.every((crew) => crew.rosterOnly)).toBe(true);
    expect(crews.every((crew) => crew.truckName === "—")).toBe(true);
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
