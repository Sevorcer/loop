// ============================================================
// Live Operations — Mock Data
// Sprint 16
//
// Mock operational events for 2026-07-19, reflected at ~9:42 AM.
// Based on the same crew and job context as Morning Operations.
// ============================================================

import type {
  InitialCrewSeed,
  InitialWorkOrderSeed,
  LiveOpsSnapshot,
  OperationalEvent,
} from "../types/liveOps";
import { assembleLiveOpsSnapshot } from "../utils/liveOpsUtils";

// ------------------------------------------------------------------
// Crew seeds
// Mirrored from mockMorningOperations.ts — no duplication of detail,
// just the minimal identity needed for derivation.
// ------------------------------------------------------------------

const crewSeeds: InitialCrewSeed[] = [
  { crewId: "crew-marcus-rivera", crewName: "Install Truck 4", technician: "Marcus Rivera" },
  { crewId: "crew-tina-brooks", crewName: "Service Van 2", technician: "Tina Brooks" },
  { crewId: "crew-jordan-lee", crewName: "Service Truck 7", technician: "Jordan Lee" },
  { crewId: "crew-riley-morgan", crewName: "Install Van 6", technician: "Riley Morgan" },
  { crewId: "crew-taylor-reed", crewName: "Service Van 9", technician: "Taylor Reed" },
];

// ------------------------------------------------------------------
// Work order seeds
// ------------------------------------------------------------------

const workOrderSeeds: InitialWorkOrderSeed[] = [
  {
    id: "job-001",
    jobNumber: "WO-1001",
    customer: "Pacific Tower",
    address: "800 Pike St, Seattle",
    description: "Carrier 10-ton rooftop package unit replacement",
    assignedCrewId: "crew-marcus-rivera",
    assignedCrewName: "Marcus Rivera",
    estimatedHours: 8,
  },
  {
    id: "job-009",
    jobNumber: "WO-1009",
    customer: "Capitol Hill Fitness",
    address: "1204 E Pike St, Seattle",
    description: "Mitsubishi 24k BTU ductless mini-split install",
    assignedCrewId: "crew-riley-morgan",
    assignedCrewName: "Riley Morgan",
    estimatedHours: 6.5,
  },
  {
    id: "job-010",
    jobNumber: "WO-1010",
    customer: "Southgate HOA",
    address: "1920 S Renton Village Pl, Renton",
    description: "Daikin rooftop air handler maintenance",
    assignedCrewId: "crew-tina-brooks",
    assignedCrewName: "Tina Brooks",
    estimatedHours: 3,
  },
  {
    id: "job-013",
    jobNumber: "WO-1013",
    customer: "Bellevue Tech Campus",
    address: "15800 NE 8th St, Bellevue",
    description: "York rooftop unit B-3 diagnostic",
    assignedCrewId: "crew-jordan-lee",
    assignedCrewName: "Jordan Lee",
    estimatedHours: 5,
  },
  {
    id: "job-012",
    jobNumber: "WO-1012",
    customer: "Eastgate Condos",
    address: "14900 SE Newport Way, Bellevue",
    description: "East wing furnace gas valve emergency diagnostic",
    assignedCrewId: "",
    assignedCrewName: "Unassigned",
    estimatedHours: 4,
  },
  {
    id: "job-005",
    jobNumber: "WO-1005",
    customer: "Tacoma Manufacturing",
    address: "1455 Marine View Dr, Tacoma",
    description: "Copeland scroll compressor assembly replacement",
    assignedCrewId: "",
    assignedCrewName: "Unassigned",
    estimatedHours: 4.5,
  },
  {
    id: "job-015",
    jobNumber: "WO-1015",
    customer: "Clearwater Office Park",
    address: "4800 Clearwater Pkwy, Building C",
    description: "Packaged rooftop conversion",
    assignedCrewId: "crew-taylor-reed",
    assignedCrewName: "Taylor Reed",
    estimatedHours: 8,
  },
];

// ------------------------------------------------------------------
// Operational event stream for 2026-07-19
// Events must be in chronological order.
// resolved=true means the event no longer appears in
// Needs Attention or Decision Feed.
// ------------------------------------------------------------------

const events: OperationalEvent[] = [
  // ---- 8:02 ---- Operations launched ----
  {
    id: "evt-001",
    type: "operations_started",
    timestamp: "2026-07-19T08:02:00Z",
    timeLabel: "8:02 AM",
    sourceType: "system",
    sourceId: "system",
    severity: "info",
    title: "Operations Started",
    description: "Morning Operations launched. Crews cleared to roll.",
  },

  // ---- 8:15 ---- Marcus Rivera dispatched ----
  {
    id: "evt-002",
    type: "crew_dispatched",
    timestamp: "2026-07-19T08:15:00Z",
    timeLabel: "8:15 AM",
    sourceType: "crew",
    sourceId: "crew-marcus-rivera",
    severity: "info",
    title: "Marcus Rivera Dispatched",
    description: "Install Truck 4 en route to Pacific Tower — rooftop RTU replacement.",
    relatedCrewId: "crew-marcus-rivera",
    relatedWorkOrderId: "job-001",
    actionRecommendation: "ETA 8:45 AM",
  },

  // ---- 8:18 ---- Riley Morgan dispatched ----
  {
    id: "evt-003",
    type: "crew_dispatched",
    timestamp: "2026-07-19T08:18:00Z",
    timeLabel: "8:18 AM",
    sourceType: "crew",
    sourceId: "crew-riley-morgan",
    severity: "info",
    title: "Riley Morgan Dispatched",
    description: "Install Van 6 en route to Capitol Hill Fitness — mini-split install.",
    relatedCrewId: "crew-riley-morgan",
    relatedWorkOrderId: "job-009",
    actionRecommendation: "ETA 8:50 AM",
  },

  // ---- 8:22 ---- Tina Brooks dispatched ----
  {
    id: "evt-004",
    type: "crew_dispatched",
    timestamp: "2026-07-19T08:22:00Z",
    timeLabel: "8:22 AM",
    sourceType: "crew",
    sourceId: "crew-tina-brooks",
    severity: "info",
    title: "Tina Brooks Dispatched",
    description: "Service Van 2 en route to Southgate HOA — rooftop maintenance.",
    relatedCrewId: "crew-tina-brooks",
    relatedWorkOrderId: "job-010",
    actionRecommendation: "ETA 9:00 AM",
  },

  // ---- 8:41 ---- Riley Morgan arrives ----
  {
    id: "evt-005",
    type: "crew_arrived",
    timestamp: "2026-07-19T08:41:00Z",
    timeLabel: "8:41 AM",
    sourceType: "crew",
    sourceId: "crew-riley-morgan",
    severity: "info",
    title: "Riley Morgan Arrived",
    description: "Install Van 6 on site at Capitol Hill Fitness.",
    relatedCrewId: "crew-riley-morgan",
    relatedWorkOrderId: "job-009",
  },

  // ---- 8:52 ---- Riley Morgan starts working ----
  {
    id: "evt-006",
    type: "milestone_advanced",
    timestamp: "2026-07-19T08:52:00Z",
    timeLabel: "8:52 AM",
    sourceType: "crew",
    sourceId: "crew-riley-morgan",
    severity: "info",
    title: "Installation Working — WO-1009",
    description: "Mini-split installation underway at Capitol Hill Fitness.",
    relatedCrewId: "crew-riley-morgan",
    relatedWorkOrderId: "job-009",
    newMilestone: "working",
  },

  // ---- 9:00 ---- Tina Brooks arrives ----
  {
    id: "evt-007",
    type: "crew_arrived",
    timestamp: "2026-07-19T09:00:00Z",
    timeLabel: "9:00 AM",
    sourceType: "crew",
    sourceId: "crew-tina-brooks",
    severity: "info",
    title: "Tina Brooks Arrived",
    description: "Service Van 2 on site at Southgate HOA.",
    relatedCrewId: "crew-tina-brooks",
    relatedWorkOrderId: "job-010",
  },

  // ---- 9:05 ---- Jordan Lee delayed — nitrogen outstanding ----
  {
    id: "evt-008",
    type: "crew_delayed",
    timestamp: "2026-07-19T09:05:00Z",
    timeLabel: "9:05 AM",
    sourceType: "crew",
    sourceId: "crew-jordan-lee",
    severity: "warning",
    title: "Jordan Lee Delayed",
    description: "Nitrogen tank still outstanding. Warehouse runner delayed by traffic.",
    relatedCrewId: "crew-jordan-lee",
    relatedWorkOrderId: "job-013",
    actionRecommendation: "Contact warehouse runner for ETA update.",
    // Resolved once nitrogen is delivered (evt-010)
    resolved: true,
  },

  // ---- 9:12 ---- Marcus Rivera arrives ----
  {
    id: "evt-009",
    type: "crew_arrived",
    timestamp: "2026-07-19T09:12:00Z",
    timeLabel: "9:12 AM",
    sourceType: "crew",
    sourceId: "crew-marcus-rivera",
    severity: "info",
    title: "Marcus Rivera Arrived",
    description: "Install Truck 4 on site at Pacific Tower. Crane operator confirmed.",
    relatedCrewId: "crew-marcus-rivera",
    relatedWorkOrderId: "job-001",
  },

  // ---- 9:16 ---- Nitrogen delivered — Jordan Lee delay resolved ----
  {
    id: "evt-010",
    type: "material_delivered",
    timestamp: "2026-07-19T09:16:00Z",
    timeLabel: "9:16 AM",
    sourceType: "work_order",
    sourceId: "job-013",
    severity: "info",
    title: "Nitrogen Delivered",
    description: "Warehouse runner delivered nitrogen to Jordan Lee. Delay cleared.",
    relatedCrewId: "crew-jordan-lee",
    relatedWorkOrderId: "job-013",
  },

  // ---- 9:20 ---- Tina Brooks starts working ----
  {
    id: "evt-011",
    type: "milestone_advanced",
    timestamp: "2026-07-19T09:20:00Z",
    timeLabel: "9:20 AM",
    sourceType: "crew",
    sourceId: "crew-tina-brooks",
    severity: "info",
    title: "Maintenance Working — WO-1010",
    description: "Rooftop air handler maintenance underway at Southgate HOA.",
    relatedCrewId: "crew-tina-brooks",
    relatedWorkOrderId: "job-010",
    newMilestone: "working",
  },

  // ---- 9:22 ---- Jordan Lee dispatched (after delay cleared) ----
  {
    id: "evt-012",
    type: "crew_dispatched",
    timestamp: "2026-07-19T09:22:00Z",
    timeLabel: "9:22 AM",
    sourceType: "crew",
    sourceId: "crew-jordan-lee",
    severity: "info",
    title: "Jordan Lee Dispatched",
    description: "Service Truck 7 now en route to Bellevue Tech Campus. Delay cleared.",
    relatedCrewId: "crew-jordan-lee",
    relatedWorkOrderId: "job-013",
    actionRecommendation: "ETA 9:45 AM",
  },

  // ---- 9:28 ---- Customer unavailable — WO-1012 (unresolved) ----
  {
    id: "evt-013",
    type: "customer_delay",
    timestamp: "2026-07-19T09:28:00Z",
    timeLabel: "9:28 AM",
    sourceType: "work_order",
    sourceId: "job-012",
    severity: "critical",
    title: "Customer Unavailable — WO-1012",
    description: "Eastgate Condos building manager unreachable. Emergency call cannot proceed without access authorization.",
    relatedWorkOrderId: "job-012",
    actionRecommendation: "Call building manager. If no response in 15 min, escalate to owner.",
    requiresDecision: true,
    decisionOptions: [
      "Continue calling building manager",
      "Escalate to company owner",
      "Reschedule for PM slot",
    ],
  },

  // ---- 9:35 ---- ETA slip — Marcus Rivera (unresolved) ----
  {
    id: "evt-014",
    type: "eta_slip",
    timestamp: "2026-07-19T09:35:00Z",
    timeLabel: "9:35 AM",
    sourceType: "crew",
    sourceId: "crew-marcus-rivera",
    severity: "warning",
    title: "ETA Slip — WO-1001",
    description: "Crane access window delayed. Pacific Tower loading dock backup. Crane operator now confirmed for 10:15 AM.",
    relatedCrewId: "crew-marcus-rivera",
    relatedWorkOrderId: "job-001",
    actionRecommendation: "Monitor. Customer already notified by site manager.",
    requiresDecision: true,
    decisionOptions: [
      "Monitor — site manager has it",
      "Call customer directly",
      "Reassign Marcus to another job while waiting",
    ],
  },

  // ---- 9:42 ---- Permit issue — WO-1005 (unresolved, critical) ----
  {
    id: "evt-015",
    type: "permit_issue",
    timestamp: "2026-07-19T09:42:00Z",
    timeLabel: "9:42 AM",
    sourceType: "work_order",
    sourceId: "job-005",
    severity: "critical",
    title: "Permit Issue — WO-1005",
    description: "Tacoma Manufacturing permit was not approved. Plant inspection required before compressor work can begin.",
    relatedWorkOrderId: "job-005",
    actionRecommendation: "Contact permit office immediately. Work cannot start today without resolution.",
    requiresDecision: true,
    decisionOptions: [
      "Call Tacoma permit office",
      "Defer job to next available day",
      "Request emergency permit review",
    ],
  },

  // ---- 6:55 ---- Install Truck 4 fully loaded for JOB-1001 (inventory event) ----
  {
    id: "evt-016",
    type: "truck_loaded",
    timestamp: "2026-07-19T06:55:00Z",
    timeLabel: "6:55 AM",
    sourceType: "work_order",
    sourceId: "job-001",
    severity: "info",
    title: "Truck Loaded — WO-1001",
    description: "Install Truck 4 fully loaded for Smith Residence. All 8 material plan items picked and loaded. Crew ready to roll.",
    relatedWorkOrderId: "job-001",
    relatedCrewId: "crew-marcus-rivera",
  },

  // ---- 7:15 ---- MHK2 thermostat backordered for JOB-1009 (inventory event) ----
  {
    id: "evt-017",
    type: "backorder_created",
    timestamp: "2026-07-19T07:15:00Z",
    timeLabel: "7:15 AM",
    sourceType: "work_order",
    sourceId: "job-009",
    severity: "warning",
    title: "Backorder — MHK2 Thermostat",
    description: "Mitsubishi MHK2 thermostat adapter for Johnson Residence is backordered. Expected arrival 2026-07-22. Install can proceed; thermostat installation deferred.",
    relatedWorkOrderId: "job-009",
    actionRecommendation: "Notify customer that thermostat will be installed at a follow-up visit.",
    requiresDecision: false,
  },

  // ---- 7:30 ---- Clearwater rooftop unit blocked (inventory event) ----
  {
    id: "evt-018",
    type: "missing_equipment",
    timestamp: "2026-07-19T07:30:00Z",
    timeLabel: "7:30 AM",
    sourceType: "work_order",
    sourceId: "job-015",
    severity: "critical",
    title: "Equipment Unavailable — WO-1015",
    description: "Carrier 48,000 BTU packaged rooftop unit for Clearwater Building C is backordered until 2026-07-28. Job cannot be dispatched without the primary equipment.",
    relatedWorkOrderId: "job-015",
    actionRecommendation: "Contact Clearwater to reschedule. Notify Taylor Reed not to dispatch.",
    requiresDecision: true,
    decisionOptions: [
      "Reschedule job to 2026-07-28",
      "Source rooftop unit from alternate supplier",
      "Contact customer to explain delay",
    ],
  },
];

// ------------------------------------------------------------------
// Exported factory
// ------------------------------------------------------------------

/**
 * Returns the assembled Live Operations snapshot for the given date.
 * `startedAt` is the ISO timestamp from DailyPlansProvider.
 */
export function getMockLiveOpsSnapshot(
  date: string,
  startedAt: string
): LiveOpsSnapshot {
  return assembleLiveOpsSnapshot(date, startedAt, events, crewSeeds, workOrderSeeds);
}
