import type { DispatchPlan } from "../types/dispatch";

/**
 * Mock Dispatch Plans for Sprint 19.
 * DispatchPlan is the aggregate root of the Dispatch domain.
 *
 * Each plan shows a different dispatch state to exercise the full model:
 *
 * JOB-1001 — Smith Residence    → Scheduled (all readiness satisfied, crew assigned)
 * JOB-1009 — Johnson Residence  → Awaiting Customer Confirmation
 * JOB-1015 — Clearwater Bldg C  → Awaiting Materials (outdoor unit backordered)
 * JOB-1022 — Park District HQ   → Awaiting Crew Availability (all ready, no crew)
 * JOB-1031 — Harmon Residence   → Ready to Schedule (all conditions met)
 * JOB-1007 — Metro Station B    → In Progress (crew on site)
 */
export const mockDispatchPlans: DispatchPlan[] = [
  // ----------------------------------------------------------------
  // JOB-1001 — Smith Residence — Mitsubishi Hyper Heat
  // Status: SCHEDULED — crew assigned, block on calendar
  // ----------------------------------------------------------------
  {
    id: "dp-001",
    jobId: "job-001",
    jobNumber: "JOB-1001",
    customerName: "John Smith",
    propertyName: "Smith Residence",
    jobType: "Install",
    dispatchStatus: "scheduled",
    dispatchability: {
      isDispatchable: true,
      materialReadiness: {
        state: "satisfied",
        reason: "All items picked and loaded on Install Truck 4.",
      },
      technicalReadiness: {
        state: "satisfied",
        reason: "Installed system record confirmed. Technical profile complete.",
      },
      customerReadiness: {
        state: "satisfied",
        reason: "Customer confirmed arrival window 7:00–7:30 AM.",
      },
      crewReadiness: {
        state: "satisfied",
        reason: "Marcus Rivera crew assigned and confirmed.",
      },
    },
    targetDate: "2026-07-21",
    estimatedDurationHours: 8,
    priority: "high",
    appointmentWindow: "Morning",
    sequencingNotes: "Full system replacement. Outdoor unit first, then air handler. Startup after both units confirmed.",
    constraints: [
      { label: "Crane permit required on-site", severity: "warning" },
    ],
    createdAt: "2026-07-18T14:30:00Z",
    updatedAt: "2026-07-19T08:00:00Z",
  },

  // ----------------------------------------------------------------
  // JOB-1009 — Johnson Residence — Mitsubishi Ducted
  // Status: AWAITING CUSTOMER CONFIRMATION
  // ----------------------------------------------------------------
  {
    id: "dp-002",
    jobId: "job-009",
    jobNumber: "JOB-1009",
    customerName: "Mike Johnson",
    propertyName: "Johnson Residence",
    jobType: "Install",
    dispatchStatus: "awaiting_customer_confirmation",
    dispatchability: {
      isDispatchable: false,
      materialReadiness: {
        state: "attention_needed",
        reason: "Thermostat backordered (expected 2026-07-22). Crew can proceed but thermostat install deferred.",
      },
      technicalReadiness: {
        state: "satisfied",
        reason: "Installed system profile confirmed.",
      },
      customerReadiness: {
        state: "not_satisfied",
        reason: "Customer not yet confirmed for July 19 window. Follow-up required.",
      },
      crewReadiness: {
        state: "satisfied",
        reason: "Tina Brooks crew available for July 19.",
      },
    },
    targetDate: "2026-07-19",
    estimatedDurationHours: 6.5,
    priority: "normal",
    appointmentWindow: "Afternoon",
    constraints: [
      { label: "Mechanical room key with gym manager", severity: "note" },
    ],
    createdAt: "2026-07-18T15:00:00Z",
    updatedAt: "2026-07-19T07:20:00Z",
  },

  // ----------------------------------------------------------------
  // JOB-1015 — Clearwater Building C — Packaged Rooftop
  // Status: AWAITING MATERIALS — outdoor unit backordered
  // ----------------------------------------------------------------
  {
    id: "dp-003",
    jobId: "job-015",
    jobNumber: "JOB-1015",
    customerName: "Clearwater Office Park",
    propertyName: "Clearwater Building C",
    jobType: "Commercial Install",
    dispatchStatus: "awaiting_materials",
    dispatchability: {
      isDispatchable: false,
      materialReadiness: {
        state: "not_satisfied",
        reason: "Carrier 48k BTU rooftop unit backordered. Expected 2026-07-28. Job cannot proceed.",
      },
      technicalReadiness: {
        state: "satisfied",
        reason: "RTU submittal approved. Technical profile confirmed.",
      },
      customerReadiness: {
        state: "satisfied",
        reason: "Customer confirmed and aware of backorder delay.",
      },
      crewReadiness: {
        state: "satisfied",
        reason: "Jordan Lee commercial crew reserved for when materials arrive.",
      },
    },
    targetDate: "2026-07-28",
    estimatedDurationHours: 10,
    priority: "high",
    sequencingNotes: "Rooftop lift requires crane. Curb adapter must be set first. Controls sequence after unit placement.",
    constraints: [
      { label: "Crane rental must be rescheduled", severity: "blocking" },
      { label: "Roof access requires facility escort", severity: "warning" },
    ],
    createdAt: "2026-07-18T16:00:00Z",
    updatedAt: "2026-07-18T16:00:00Z",
  },

  // ----------------------------------------------------------------
  // JOB-1022 — Park District HQ — Chiller Room Service
  // Status: AWAITING CREW AVAILABILITY — all ready, no crew open
  // ----------------------------------------------------------------
  {
    id: "dp-004",
    jobId: "job-022",
    jobNumber: "JOB-1022",
    customerName: "Seattle Park District",
    propertyName: "Park District HQ",
    jobType: "Service",
    dispatchStatus: "awaiting_crew_availability",
    dispatchability: {
      isDispatchable: false,
      materialReadiness: {
        state: "satisfied",
        reason: "All service parts reserved and ready.",
      },
      technicalReadiness: {
        state: "satisfied",
        reason: "Equipment history reviewed. System profile complete.",
      },
      customerReadiness: {
        state: "satisfied",
        reason: "Facility manager confirmed July 22 window.",
      },
      crewReadiness: {
        state: "not_satisfied",
        reason: "All Commercial RTU–certified crews fully booked for July 22. Next availability: July 23.",
      },
    },
    targetDate: "2026-07-23",
    estimatedDurationHours: 5,
    priority: "normal",
    constraints: [
      { label: "Chiller room requires Commercial RTU certification", severity: "blocking" },
    ],
    createdAt: "2026-07-17T11:00:00Z",
    updatedAt: "2026-07-19T09:00:00Z",
  },

  // ----------------------------------------------------------------
  // JOB-1031 — Harmon Residence — Full Heat Pump Replacement
  // Status: READY TO SCHEDULE — all conditions met, not yet placed
  // ----------------------------------------------------------------
  {
    id: "dp-005",
    jobId: "job-031",
    jobNumber: "JOB-1031",
    customerName: "Patricia Harmon",
    propertyName: "Harmon Residence",
    jobType: "Install",
    dispatchStatus: "ready_to_schedule",
    dispatchability: {
      isDispatchable: true,
      materialReadiness: {
        state: "satisfied",
        reason: "All equipment and materials reserved and ready to load.",
      },
      technicalReadiness: {
        state: "satisfied",
        reason: "Installed system profile confirmed. Permit ready.",
      },
      customerReadiness: {
        state: "satisfied",
        reason: "Customer confirmed any weekday this week.",
      },
      crewReadiness: {
        state: "satisfied",
        reason: "Riley Morgan crew has open capacity Thursday and Friday.",
      },
    },
    targetDate: "2026-07-24",
    estimatedDurationHours: 7,
    priority: "normal",
    appointmentWindow: "Morning",
    constraints: [],
    createdAt: "2026-07-19T08:00:00Z",
    updatedAt: "2026-07-19T08:00:00Z",
  },

  // ----------------------------------------------------------------
  // JOB-1007 — Metro Station B — Commercial HVAC Service
  // Status: IN PROGRESS — crew on site
  // ----------------------------------------------------------------
  {
    id: "dp-006",
    jobId: "job-007",
    jobNumber: "JOB-1007",
    customerName: "Metro Transit Authority",
    propertyName: "Metro Station B",
    jobType: "Commercial Service",
    dispatchStatus: "in_progress",
    dispatchability: {
      isDispatchable: true,
      materialReadiness: {
        state: "satisfied",
        reason: "All parts loaded. Truck dispatched.",
      },
      technicalReadiness: {
        state: "satisfied",
        reason: "Equipment service history reviewed.",
      },
      customerReadiness: {
        state: "satisfied",
        reason: "Facility confirmed. Escort on standby.",
      },
      crewReadiness: {
        state: "satisfied",
        reason: "Jordan Lee crew dispatched at 7:15 AM.",
      },
    },
    targetDate: "2026-07-19",
    estimatedDurationHours: 4.5,
    priority: "high",
    constraints: [
      { label: "Station access requires MTA badge scan", severity: "note" },
    ],
    createdAt: "2026-07-18T17:00:00Z",
    updatedAt: "2026-07-19T07:15:00Z",
  },
];
