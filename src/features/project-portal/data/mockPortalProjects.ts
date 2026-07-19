import type { PortalProject } from "../types/portalTypes";

// ─── Mock Organizations ───────────────────────────────────────────────────────

export const mockOrgs = [
  { id: "org-001", name: "SunState HVAC" },
  { id: "org-002", name: "Metro Construction Group" },
];

// ─── Mock Projects ────────────────────────────────────────────────────────────

export const mockPortalProjects: PortalProject[] = [
  {
    id: "proj-0001",
    orgId: "org-001",
    name: "Residential HVAC Replacement — 4210 Maple Ridge Ln",
    address: "4210 Maple Ridge Ln, Orlando, FL 32801",
    status: "in_progress",
    completionPct: 62,
    estimatedCompletionDate: "2026-08-15",
    nextMilestone: "Inspection Passed",
    projectManager: "Carlos Rivera",
    lastSyncedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(), // 2 min ago
    photosEnabled: true,
  },
  {
    id: "proj-0002",
    orgId: "org-001",
    name: "Commercial Roof-Top Unit Install — Westgate Plaza Suite 12",
    address: "1800 Westgate Blvd Suite 12, Orlando, FL 32808",
    status: "inspection_pending",
    completionPct: 85,
    estimatedCompletionDate: "2026-07-28",
    nextMilestone: "Final Walkthrough",
    projectManager: "Maria Santos",
    lastSyncedAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(), // 8 min ago (stale)
    photosEnabled: true,
  },
  {
    id: "proj-0003",
    orgId: "org-002",
    name: "New Construction HVAC — Lakeside Estates Lot 7",
    address: "7 Lakeside Estates Dr, Kissimmee, FL 34744",
    status: "in_progress",
    completionPct: 40,
    estimatedCompletionDate: "2026-09-30",
    nextMilestone: "Rough-In Complete",
    projectManager: "James Thornton",
    lastSyncedAt: new Date(Date.now() - 1 * 60 * 1000).toISOString(), // 1 min ago
    photosEnabled: false,
  },
];

// ─── Mock Portal Users ────────────────────────────────────────────────────────

export const mockPortalUsers = [
  {
    id: "user-homeowner-001",
    name: "Alex Chen",
    email: "alex.chen@example.com",
    memberships: [
      {
        orgId: "org-001",
        roles: ["homeowner" as const],
        projectIds: ["proj-0001"],
        active: true,
      },
    ],
  },
  {
    id: "user-gc-001",
    name: "Jordan Lee",
    email: "jordan.lee@metroconstruction.com",
    memberships: [
      {
        orgId: "org-001",
        roles: ["gc" as const],
        projectIds: [],
        active: true,
      },
      {
        orgId: "org-002",
        roles: ["gc" as const, "builder" as const],
        projectIds: [],
        active: true,
      },
    ],
  },
  {
    id: "user-revoked-001",
    name: "Sam Taylor",
    email: "sam.taylor@example.com",
    memberships: [
      {
        orgId: "org-001",
        roles: ["homeowner" as const],
        projectIds: ["proj-0001"],
        active: false,
      },
    ],
  },
];

/** The currently active demo user (simulates session context) */
export const DEMO_USER_ID = "user-homeowner-001";
/** The demo project shown on /portal landing */
export const DEMO_PROJECT_ID = "proj-0001";
