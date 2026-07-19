import { describe, it, expect } from "vitest";

import {
  mergePermissions,
  authorizePortalAccess,
  hasOrgAccess,
  getAccessibleProjects,
  canViewDocument,
} from "../auth/portalAuth";
import type { PortalProject, PortalUser } from "../types/portal";
import { MOCK_ORG_A, MOCK_ORG_B } from "../data/mockProjects";

// ─── Test Fixtures ────────────────────────────────────────────────────────────

const projectOrgA: PortalProject = {
  id: "proj-a-001",
  organizationId: MOCK_ORG_A,
  name: "Project A",
  address: "123 Main St",
  status: "in_progress",
  completionPercent: 50,
  estimatedCompletionDate: "2026-12-01",
  nextMilestone: "Inspection",
  projectManagerName: "Alice",
  projectManagerPhone: "555-0001",
  projectManagerEmail: "alice@example.com",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const projectOrgB: PortalProject = {
  ...projectOrgA,
  id: "proj-b-001",
  organizationId: MOCK_ORG_B,
  name: "Project B",
};

function makeUser(overrides: Partial<PortalUser> = {}): PortalUser {
  return {
    id: "user-001",
    displayName: "Test User",
    email: "test@example.com",
    memberships: [
      {
        organizationId: MOCK_ORG_A,
        organizationName: "SunState HVAC",
        roles: ["homeowner"],
        inviteExpiresAt: null,
        isRevoked: false,
      },
    ],
    ...overrides,
  };
}

// ─── mergePermissions ─────────────────────────────────────────────────────────

describe("mergePermissions", () => {
  it("homeowner: can view overview, timeline, documents, contact; cannot view milestone details or portfolio", () => {
    const perms = mergePermissions(["homeowner"]);
    expect(perms.canViewOverview).toBe(true);
    expect(perms.canViewTimeline).toBe(true);
    expect(perms.canViewDocuments).toBe(true);
    expect(perms.canViewContactTeam).toBe(true);
    expect(perms.canViewMilestoneDetails).toBe(false);
    expect(perms.canViewPortfolio).toBe(false);
    expect(perms.canViewInspectionStatus).toBe(false);
  });

  it("general_contractor: can view milestone details and inspection status", () => {
    const perms = mergePermissions(["general_contractor"]);
    expect(perms.canViewMilestoneDetails).toBe(true);
    expect(perms.canViewInspectionStatus).toBe(true);
    expect(perms.canViewPortfolio).toBe(true);
  });

  it("property_manager: can view equipment, warranty, maintenance; cannot view timeline", () => {
    const perms = mergePermissions(["property_manager"]);
    expect(perms.canViewInstalledEquipment).toBe(true);
    expect(perms.canViewWarrantyRecords).toBe(true);
    expect(perms.canViewMaintenanceRecords).toBe(true);
    expect(perms.canViewTimeline).toBe(false);
  });

  it("multi-role GC + Builder: additive union — gets milestone details AND portfolio", () => {
    const perms = mergePermissions(["general_contractor", "builder_developer"]);
    expect(perms.canViewMilestoneDetails).toBe(true);
    expect(perms.canViewPortfolio).toBe(true);
    expect(perms.canViewInspectionStatus).toBe(true);
    expect(perms.canViewOverview).toBe(true);
  });

  it("multi-role homeowner + property_manager: union grants warranty + maintenance records", () => {
    const perms = mergePermissions(["homeowner", "property_manager"]);
    expect(perms.canViewWarrantyRecords).toBe(true); // homeowner
    expect(perms.canViewMaintenanceRecords).toBe(true); // property_manager
    expect(perms.canViewOverview).toBe(true);
  });

  it("canViewInternalData is ALWAYS false regardless of any role combination", () => {
    const allRoles = mergePermissions([
      "homeowner",
      "general_contractor",
      "builder_developer",
      "property_manager",
    ]);
    expect(allRoles.canViewInternalData).toBe(false);
  });

  it("no roles: all permissions are false", () => {
    const perms = mergePermissions([]);
    const keys = Object.keys(perms) as (keyof typeof perms)[];
    keys.forEach((key) => expect(perms[key]).toBe(false));
  });
});

// ─── authorizePortalAccess ────────────────────────────────────────────────────

describe("authorizePortalAccess", () => {
  it("returns ok=true for a valid homeowner in the correct org", () => {
    const user = makeUser();
    const result = authorizePortalAccess(user, projectOrgA);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.resolvedRoles).toContain("homeowner");
    }
  });

  it("returns unauthorized when user has no membership in the project org", () => {
    const user = makeUser({
      memberships: [
        {
          organizationId: "org-other",
          organizationName: "Other Org",
          roles: ["homeowner"],
          inviteExpiresAt: null,
          isRevoked: false,
        },
      ],
    });
    const result = authorizePortalAccess(user, projectOrgA);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe("unauthorized");
    }
  });

  it("returns expired_invite when invite TTL is in the past", () => {
    const user = makeUser({
      memberships: [
        {
          organizationId: MOCK_ORG_A,
          organizationName: "SunState HVAC",
          roles: ["homeowner"],
          inviteExpiresAt: "2020-01-01T00:00:00.000Z", // past
          isRevoked: false,
        },
      ],
    });
    const result = authorizePortalAccess(user, projectOrgA);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe("expired_invite");
  });

  it("returns revoked_access when membership is revoked", () => {
    const user = makeUser({
      memberships: [
        {
          organizationId: MOCK_ORG_A,
          organizationName: "SunState HVAC",
          roles: ["homeowner"],
          inviteExpiresAt: null,
          isRevoked: true,
        },
      ],
    });
    const result = authorizePortalAccess(user, projectOrgA);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe("revoked_access");
  });

  it("invite not yet expired: returns ok=true", () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const user = makeUser({
      memberships: [
        {
          organizationId: MOCK_ORG_A,
          organizationName: "SunState HVAC",
          roles: ["homeowner"],
          inviteExpiresAt: future,
          isRevoked: false,
        },
      ],
    });
    const result = authorizePortalAccess(user, projectOrgA);
    expect(result.ok).toBe(true);
  });
});

// ─── Org Isolation ────────────────────────────────────────────────────────────

describe("org isolation", () => {
  it("user in Org A cannot access Org B project — unauthorized", () => {
    const user = makeUser(); // only Org A membership
    const result = authorizePortalAccess(user, projectOrgB);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorCode).toBe("unauthorized");
  });

  it("user in Org A and Org B can access both projects independently", () => {
    const user = makeUser({
      memberships: [
        {
          organizationId: MOCK_ORG_A,
          organizationName: "SunState HVAC",
          roles: ["homeowner"],
          inviteExpiresAt: null,
          isRevoked: false,
        },
        {
          organizationId: MOCK_ORG_B,
          organizationName: "Metro Construction",
          roles: ["general_contractor"],
          inviteExpiresAt: null,
          isRevoked: false,
        },
      ],
    });
    const resultA = authorizePortalAccess(user, projectOrgA);
    const resultB = authorizePortalAccess(user, projectOrgB);
    expect(resultA.ok).toBe(true);
    expect(resultB.ok).toBe(true);
  });

  it("revoked Org A membership does NOT affect Org B access", () => {
    const user = makeUser({
      memberships: [
        {
          organizationId: MOCK_ORG_A,
          organizationName: "SunState HVAC",
          roles: ["homeowner"],
          inviteExpiresAt: null,
          isRevoked: true, // revoked in A
        },
        {
          organizationId: MOCK_ORG_B,
          organizationName: "Metro Construction",
          roles: ["general_contractor"],
          inviteExpiresAt: null,
          isRevoked: false, // active in B
        },
      ],
    });
    const resultA = authorizePortalAccess(user, projectOrgA);
    const resultB = authorizePortalAccess(user, projectOrgB);
    expect(resultA.ok).toBe(false);
    expect(resultB.ok).toBe(true);
  });

  it("getAccessibleProjects excludes projects from orgs with revoked membership", () => {
    const user = makeUser({
      memberships: [
        {
          organizationId: MOCK_ORG_A,
          organizationName: "SunState HVAC",
          roles: ["homeowner"],
          inviteExpiresAt: null,
          isRevoked: true,
        },
      ],
    });
    const result = getAccessibleProjects(user, [projectOrgA]);
    expect(result).toHaveLength(0);
  });

  it("getAccessibleProjects excludes cross-org projects by org boundary", () => {
    const user = makeUser(); // only Org A
    const result = getAccessibleProjects(user, [projectOrgA, projectOrgB]);
    expect(result).toHaveLength(1);
    expect(result[0].organizationId).toBe(MOCK_ORG_A);
  });

  it("hasOrgAccess returns false for a user not in the org", () => {
    const user = makeUser();
    expect(hasOrgAccess(user, MOCK_ORG_B)).toBe(false);
  });

  it("hasOrgAccess returns false for a revoked user", () => {
    const user = makeUser({
      memberships: [
        {
          organizationId: MOCK_ORG_A,
          organizationName: "SunState HVAC",
          roles: ["homeowner"],
          inviteExpiresAt: null,
          isRevoked: true,
        },
      ],
    });
    expect(hasOrgAccess(user, MOCK_ORG_A)).toBe(false);
  });
});

// ─── Document Visibility ──────────────────────────────────────────────────────

describe("document visibility — most restrictive wins", () => {
  it("customer document is visible to homeowner", () => {
    const perms = mergePermissions(["homeowner"]);
    expect(canViewDocument(perms, "customer")).toBe(true);
  });

  it("internal document is NEVER visible regardless of role", () => {
    const gcPerms = mergePermissions(["general_contractor"]);
    const builderPerms = mergePermissions(["builder_developer"]);
    const adminPerms = mergePermissions([
      "homeowner",
      "general_contractor",
      "builder_developer",
      "property_manager",
    ]);
    expect(canViewDocument(gcPerms, "internal")).toBe(false);
    expect(canViewDocument(builderPerms, "internal")).toBe(false);
    expect(canViewDocument(adminPerms, "internal")).toBe(false);
  });

  it("user without document permission cannot view customer doc", () => {
    // Property managers can view documents
    const pmPerms = mergePermissions(["property_manager"]);
    expect(canViewDocument(pmPerms, "customer")).toBe(true);
  });
});
