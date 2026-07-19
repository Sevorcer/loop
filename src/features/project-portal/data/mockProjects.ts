import type { PortalProject } from "../types/portal";

export const MOCK_ORG_A = "org-sunstate-hvac";
export const MOCK_ORG_B = "org-metro-construction";

export const mockProjects: PortalProject[] = [
  {
    id: "proj-0001-uuid",
    organizationId: MOCK_ORG_A,
    name: "Whole-Home HVAC Replacement — 42 Maple Drive",
    address: "42 Maple Drive, Austin, TX 78701",
    status: "in_progress",
    completionPercent: 45,
    estimatedCompletionDate: "2026-08-15",
    nextMilestone: "Inspection Passed",
    projectManagerName: "Sarah Chen",
    projectManagerPhone: "555-100-2000",
    projectManagerEmail: "sarah.chen@sunstatehvac.com",
    createdAt: "2026-07-01T00:00:00.000Z",
  },
  {
    id: "proj-0002-uuid",
    organizationId: MOCK_ORG_A,
    name: "Commercial RTU Replacement — Orion Office Park Unit B",
    address: "1200 Commerce Blvd, Suite B, Austin, TX 78702",
    status: "in_progress",
    completionPercent: 20,
    estimatedCompletionDate: "2026-09-01",
    nextMilestone: "Materials Received",
    projectManagerName: "Marcus Webb",
    projectManagerPhone: "555-100-2001",
    projectManagerEmail: "marcus.webb@sunstatehvac.com",
    createdAt: "2026-07-08T00:00:00.000Z",
  },
  {
    id: "proj-0003-uuid",
    organizationId: MOCK_ORG_B,
    name: "Multi-Unit HVAC Install — Riverside Apartments Phase 1",
    address: "880 Riverside Way, Austin, TX 78703",
    status: "not_started",
    completionPercent: 0,
    estimatedCompletionDate: "2026-10-01",
    nextMilestone: "Estimate Approved",
    projectManagerName: "Jordan Lee",
    projectManagerPhone: "555-200-3000",
    projectManagerEmail: "jordan.lee@metroconstruction.com",
    createdAt: "2026-07-15T00:00:00.000Z",
  },
];
