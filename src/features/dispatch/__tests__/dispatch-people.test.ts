import { describe, expect, it } from "vitest";

import type { Crew, CrewAssignment } from "../types/dispatch";
import {
  addDispatchPerson,
  canAssignDispatchPeople,
  moveDispatchPerson,
  persistedAssigneeIds,
  removeDispatchPerson,
  replaceDispatchPerson,
  resolvePlanPeople,
  teamLabelForPeople,
  timeOffForPeople,
} from "../utils/dispatchPeople";

const brian = { id: "11111111-1111-4111-8111-111111111111", name: "Brian Ramirez" };
const sean = { id: "22222222-2222-4222-8222-222222222222", name: "Sean Ryan" };
const maya = { id: "33333333-3333-4333-8333-333333333333", name: "Maya Singh" };

function assignment(overrides: Partial<CrewAssignment> = {}): CrewAssignment {
  return {
    id: "asg-1",
    dispatchPlanId: "plan-1",
    jobId: "job-1",
    crewId: "crew-1",
    crewName: "Install Truck 4",
    leadInstaller: "Brian Ramirez",
    supportingTechnicians: ["Sean Ryan"],
    status: "confirmed",
    assignedAt: "2026-10-30T15:00:00.000Z",
    reassignmentHistory: [],
    ...overrides,
  };
}

const crew: Crew = {
  id: "crew-1",
  name: "Install Truck 4",
  leadInstaller: "Brian Ramirez",
  members: [
    { id: "m1", name: "Brian Ramirez", role: "lead" },
    { id: "m2", name: "Sean Ryan", role: "installer" },
    { id: "m3", name: "Alex Park", role: "helper" },
  ],
  certifications: [],
  availability: "available",
  truckName: "Install Truck 4",
};

describe("resolvePlanPeople", () => {
  it("keeps real assignees and still shows a crew name that is not a user", () => {
    const people = resolvePlanPeople({
      jobAssignees: [brian, sean],
      assignment: assignment(),
      crew,
    });
    expect(teamLabelForPeople(people)).toBe("Alex Park + Brian Ramirez + Sean Ryan");
    expect(people.find((person) => person.name === "Alex Park")?.legacy).toBe(true);
    expect(persistedAssigneeIds(people)).toEqual([brian.id, sean.id]);
  });

  it("uses the crew members when the job has nobody saved yet", () => {
    const people = resolvePlanPeople({ assignment: assignment(), crew });
    expect(people.map((person) => person.name).sort()).toEqual([
      "Alex Park",
      "Brian Ramirez",
      "Sean Ryan",
    ]);
    expect(people.every((person) => person.legacy)).toBe(true);
  });
});

describe("changing people", () => {
  it("adds, replaces, removes, and moves a person between jobs", () => {
    const added = addDispatchPerson([], brian);
    const replaced = replaceDispatchPerson(added, brian.id, sean);
    expect(replaced.map((person) => person.id)).toEqual([sean.id]);
    const withMaya = addDispatchPerson(replaced, maya);
    const moved = moveDispatchPerson(withMaya, [brian], maya.id);
    expect(moved?.source.map((person) => person.name)).toEqual(["Sean Ryan"]);
    expect(moved?.target.map((person) => person.name).sort()).toEqual(["Brian Ramirez", "Maya Singh"]);
    expect(removeDispatchPerson(withMaya, sean.id).map((person) => person.id)).toEqual([maya.id]);
  });

  it("does not drag a previous-crew name that is not a user", () => {
    const legacy = resolvePlanPeople({ assignment: assignment({ supportingTechnicians: [] }), crew: null });
    expect(moveDispatchPerson(legacy, [], legacy[0].id)).toBeNull();
  });
});

describe("time off and roles", () => {
  it("warns when an assigned person is off during the job", () => {
    const off = timeOffForPeople({
      people: [{ ...maya }],
      scheduledStartAt: "2026-10-30T16:00:00.000Z",
      scheduledEndAt: "2026-10-30T20:00:00.000Z",
      timeOff: [
        {
          userId: maya.id,
          personName: "Maya Singh",
          startsAt: "2026-10-30T15:00:00.000Z",
          endsAt: "2026-10-30T23:00:00.000Z",
          reason: "Called out sick",
        },
      ],
    });
    expect(off).toHaveLength(1);
    expect(off[0].reason).toBe("Called out sick");
  });

  it("lets office roles assign and keeps technicians from assigning", () => {
    expect(canAssignDispatchPeople("owner")).toBe(true);
    expect(canAssignDispatchPeople("manager")).toBe(true);
    expect(canAssignDispatchPeople("dispatch")).toBe(true);
    expect(canAssignDispatchPeople("office")).toBe(true);
    expect(canAssignDispatchPeople("tech")).toBe(false);
    expect(canAssignDispatchPeople("sales")).toBe(false);
    expect(canAssignDispatchPeople(null)).toBe(false);
  });
});
