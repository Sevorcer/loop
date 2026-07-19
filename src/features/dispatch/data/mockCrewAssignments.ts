import type { CrewAssignment } from "../types/dispatch";

/**
 * Mock crew assignments for Sprint 19.
 * Each assignment references a dispatchPlanId (aggregate root).
 * Dispatch owns assignments — it does not own crew records or jobs.
 */
export const mockCrewAssignments: CrewAssignment[] = [
  // DP-001 (JOB-1001 — Smith Residence) — confirmed, crew dispatched
  {
    id: "ca-001",
    dispatchPlanId: "dp-001",
    jobId: "job-001",
    crewId: "crew-marcus-rivera",
    crewName: "Rivera Install Crew",
    leadInstaller: "Marcus Rivera",
    supportingTechnicians: ["Elena Cruz"],
    status: "confirmed",
    assignedAt: "2026-07-18T16:00:00Z",
    reassignmentHistory: [],
  },

  // DP-006 (JOB-1007 — Metro Station B) — crew dispatched (in progress)
  {
    id: "ca-002",
    dispatchPlanId: "dp-006",
    jobId: "job-007",
    crewId: "crew-jordan-lee",
    crewName: "Lee Commercial Crew",
    leadInstaller: "Jordan Lee",
    supportingTechnicians: ["Chris Doyle"],
    status: "dispatched",
    assignedAt: "2026-07-18T17:30:00Z",
    reassignmentHistory: [],
  },

  // DP-002 (JOB-1009 — Johnson Residence) — proposed, awaiting customer confirmation
  {
    id: "ca-003",
    dispatchPlanId: "dp-002",
    jobId: "job-009",
    crewId: "crew-tina-brooks",
    crewName: "Brooks Service Crew",
    leadInstaller: "Tina Brooks",
    supportingTechnicians: ["Maya Singh"],
    status: "proposed",
    assignedAt: "2026-07-18T15:30:00Z",
    reassignmentHistory: [],
  },
];
