<<<<<<< HEAD
import {
  checkAuthorization,
  derivePermissions,
  resolveEffectiveRoles,
  filterVisibleDocuments,
  filterVisiblePhotos,
} from "../utils/portalAuth";
import type { PortalUser, PortalDocument, PortalPhoto } from "../types/portalTypes";

// ─── Test Fixtures ─────────────────────────────────────────────────────────────

const homeownerUser: PortalUser = {
  id: "user-homeowner",
  name: "Alex Chen",
  email: "alex@example.com",
  memberships: [
    { orgId: "org-001", roles: ["homeowner"], projectIds: ["proj-001"], active: true },
  ],
};

const gcUser: PortalUser = {
  id: "user-gc",
  name: "Jordan Lee",
  email: "jordan@example.com",
  memberships: [
    { orgId: "org-001", roles: ["gc"], projectIds: [], active: true },
    { orgId: "org-002", roles: ["gc", "builder"], projectIds: [], active: true },
  ],
};

const revokedUser: PortalUser = {
  id: "user-revoked",
  name: "Revoked User",
  email: "revoked@example.com",
  memberships: [
    { orgId: "org-001", roles: ["homeowner"], projectIds: ["proj-001"], active: false },
  ],
};

const multiOrgUser: PortalUser = {
  id: "user-multi",
  name: "Multi Org User",
  email: "multi@example.com",
  memberships: [
    { orgId: "org-001", roles: ["homeowner"], projectIds: ["proj-001"], active: true },
    { orgId: "org-002", roles: ["gc", "builder"], projectIds: [], active: true },
  ],
};

// ─── resolveEffectiveRoles ────────────────────────────────────────────────────

describe("resolveEffectiveRoles", () => {
  it("returns roles for a homeowner with explicit project access", () => {
    const result = resolveEffectiveRoles(homeownerUser, "org-001", "proj-001");
    expect(result.roles).toEqual(["homeowner"]);
    expect(result.membershipActive).toBe(true);
  });

  it("returns empty roles for a homeowner accessing a project not in their list", () => {
    const result = resolveEffectiveRoles(homeownerUser, "org-001", "proj-999");
    expect(result.roles).toHaveLength(0);
    expect(result.membershipActive).toBe(true);
  });

  it("returns empty roles when membership is not active (revoked)", () => {
    const result = resolveEffectiveRoles(revokedUser, "org-001", "proj-001");
    expect(result.roles).toHaveLength(0);
    expect(result.membershipActive).toBe(false);
  });

  it("returns empty roles for unknown org", () => {
    const result = resolveEffectiveRoles(homeownerUser, "org-999", "proj-001");
    expect(result.roles).toHaveLength(0);
  });

  it("returns all org projects for GC with empty projectIds (org-wide access)", () => {
    const result = resolveEffectiveRoles(gcUser, "org-001", "any-project");
    expect(result.roles).toEqual(["gc"]);
  });

  it("org boundaries are enforced — org-001 GC cannot access org-002 without membership", () => {
    const result = resolveEffectiveRoles(gcUser, "org-001", "proj-999");
    // GC has org-001 membership with empty projectIds — org-wide access
    expect(result.roles).toEqual(["gc"]);
  });

  it("multi-org user: correct roles returned per org (org boundary)", () => {
    const result1 = resolveEffectiveRoles(multiOrgUser, "org-001", "proj-001");
    expect(result1.roles).toEqual(["homeowner"]);

    const result2 = resolveEffectiveRoles(multiOrgUser, "org-002", "any-project");
    expect(result2.roles).toContain("gc");
    expect(result2.roles).toContain("builder");

    // org-001 roles don't bleed into org-002 context
    expect(result1.roles).not.toContain("gc");
    expect(result2.roles).not.toContain("homeowner");
  });
});

// ─── derivePermissions ────────────────────────────────────────────────────────

describe("derivePermissions", () => {
  it("homeowner: can view timeline, docs, photos, change orders, appointments, contact, warranties", () => {
    const perms = derivePermissions(["homeowner"]);
    expect(perms.canViewTimeline).toBe(true);
    expect(perms.canViewDocuments).toBe(true);
    expect(perms.canViewPhotos).toBe(true);
    expect(perms.canViewChangeOrders).toBe(true);
    expect(perms.canViewAppointments).toBe(true);
    expect(perms.canViewContact).toBe(true);
    expect(perms.canViewWarranties).toBe(true);
  });

  it("homeowner: cannot view milestone details, inspection status, portfolio, installed equipment", () => {
    const perms = derivePermissions(["homeowner"]);
    expect(perms.canViewMilestoneDetails).toBe(false);
    expect(perms.canViewInspectionStatus).toBe(false);
    expect(perms.canViewPortfolio).toBe(false);
    expect(perms.canViewInstalledEquipment).toBe(false);
    expect(perms.canViewMaintenanceRecords).toBe(false);
  });

  it("GC: can view milestone details and inspection status (beyond homeowner)", () => {
    const perms = derivePermissions(["gc"]);
=======
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
>>>>>>> origin/main
    expect(perms.canViewMilestoneDetails).toBe(true);
    expect(perms.canViewInspectionStatus).toBe(true);
    expect(perms.canViewPortfolio).toBe(true);
  });

<<<<<<< HEAD
  it("property manager: can view installed equipment, maintenance records, warranties", () => {
    const perms = derivePermissions(["property_manager"]);
    expect(perms.canViewInstalledEquipment).toBe(true);
    expect(perms.canViewMaintenanceRecords).toBe(true);
    expect(perms.canViewWarranties).toBe(true);
    expect(perms.canViewTimeline).toBe(false);
    expect(perms.canViewPhotos).toBe(false);
  });

  it("GC + Builder union: additive permissions — sees both GC and Builder entitlements", () => {
    const perms = derivePermissions(["gc", "builder"]);
    expect(perms.canViewMilestoneDetails).toBe(true);
    expect(perms.canViewInspectionStatus).toBe(true);
    expect(perms.canViewPortfolio).toBe(true);
    expect(perms.canViewTimeline).toBe(true);
  });

  it("no role: no permissions granted", () => {
    const perms = derivePermissions([]);
    expect(perms.canViewTimeline).toBe(false);
    expect(perms.canViewDocuments).toBe(false);
    expect(perms.canViewPhotos).toBe(false);
    expect(perms.canAcknowledgeChangeOrder).toBe(false);
  });

  it("only homeowner can acknowledge change orders", () => {
    expect(derivePermissions(["homeowner"]).canAcknowledgeChangeOrder).toBe(true);
    expect(derivePermissions(["gc"]).canAcknowledgeChangeOrder).toBe(false);
    expect(derivePermissions(["builder"]).canAcknowledgeChangeOrder).toBe(false);
    expect(derivePermissions(["property_manager"]).canAcknowledgeChangeOrder).toBe(false);
  });
});

// ─── checkAuthorization ───────────────────────────────────────────────────────

describe("checkAuthorization", () => {
  it("grants access for a valid homeowner", () => {
    const result = checkAuthorization({
      user: homeownerUser,
      orgId: "org-001",
      projectId: "proj-001",
      projectExists: true,
      inviteActive: true,
    });
    expect(result.granted).toBe(true);
    expect(result.errorCode).toBeNull();
    expect(result.effectiveRoles).toEqual(["homeowner"]);
    expect(result.permissions).not.toBeNull();
  });

  it("returns unauthorized when user has no org membership", () => {
    const result = checkAuthorization({
      user: homeownerUser,
      orgId: "org-999",
      projectId: "proj-001",
      projectExists: true,
      inviteActive: true,
    });
    expect(result.granted).toBe(false);
    expect(result.errorCode).toBe("unauthorized");
  });

  it("returns invite_expired when invite is not active", () => {
    const result = checkAuthorization({
      user: homeownerUser,
      orgId: "org-001",
      projectId: "proj-001",
      projectExists: true,
      inviteActive: false,
    });
    expect(result.granted).toBe(false);
    expect(result.errorCode).toBe("invite_expired");
  });

  it("returns access_revoked when membership is inactive", () => {
    const result = checkAuthorization({
      user: revokedUser,
      orgId: "org-001",
      projectId: "proj-001",
      projectExists: true,
      inviteActive: true,
    });
    expect(result.granted).toBe(false);
    expect(result.errorCode).toBe("access_revoked");
  });

  it("returns project_not_found when project does not exist", () => {
    const result = checkAuthorization({
      user: homeownerUser,
      orgId: "org-001",
      projectId: "proj-001",
      projectExists: false,
      inviteActive: true,
    });
    expect(result.granted).toBe(false);
    expect(result.errorCode).toBe("project_not_found");
  });

  it("multi-org: orgs evaluated independently — correct role per org context", () => {
    const org1Result = checkAuthorization({
      user: multiOrgUser,
      orgId: "org-001",
      projectId: "proj-001",
      projectExists: true,
      inviteActive: true,
    });
    expect(org1Result.granted).toBe(true);
    expect(org1Result.effectiveRoles).toEqual(["homeowner"]);

    const org2Result = checkAuthorization({
      user: multiOrgUser,
      orgId: "org-002",
      projectId: "proj-002",
      projectExists: true,
      inviteActive: true,
    });
    expect(org2Result.granted).toBe(true);
    expect(org2Result.effectiveRoles).toContain("gc");
    expect(org2Result.effectiveRoles).toContain("builder");
    // GC + Builder in org-002 should NOT inherit homeowner permissions
    expect(org2Result.effectiveRoles).not.toContain("homeowner");
  });
});

// ─── filterVisibleDocuments ───────────────────────────────────────────────────

describe("filterVisibleDocuments", () => {
  const docs: PortalDocument[] = [
    { id: "d1", projectId: "p1", name: "Agreement", documentType: "signed_agreement", visibility: "customer", fileSizeBytes: 100, mimeType: "application/pdf", publishedAt: "2026-07-01T00:00:00Z", allowedRoles: null },
    { id: "d2", projectId: "p1", name: "GC Report", documentType: "inspection_report", visibility: "customer", fileSizeBytes: 100, mimeType: "application/pdf", publishedAt: "2026-07-01T00:00:00Z", allowedRoles: ["gc", "builder"] },
    { id: "d3", projectId: "p1", name: "Internal Notes", documentType: "other", visibility: "internal", fileSizeBytes: 100, mimeType: "application/pdf", publishedAt: "2026-07-01T00:00:00Z", allowedRoles: null },
  ];

  it("homeowner sees all-roles documents but not GC-restricted or internal docs", () => {
    const visible = filterVisibleDocuments(docs, ["homeowner"]);
    expect(visible.map((d) => d.id)).toEqual(["d1"]);
    expect(visible).not.toContainEqual(expect.objectContaining({ id: "d3" }));
  });

  it("GC sees both all-roles and GC-restricted documents", () => {
    const visible = filterVisibleDocuments(docs, ["gc"]);
    expect(visible.map((d) => d.id)).toContain("d1");
    expect(visible.map((d) => d.id)).toContain("d2");
  });

  it("internal documents are always blocked regardless of role — most-restrictive rule", () => {
    const visible = filterVisibleDocuments(docs, ["gc", "builder", "homeowner"]);
    expect(visible).not.toContainEqual(expect.objectContaining({ id: "d3" }));
  });

  it("document visibility precedence: restricted doc not shown to non-qualifying role", () => {
    // d2 allows gc and builder only — homeowner should not see it
    const visible = filterVisibleDocuments(docs, ["homeowner"]);
    expect(visible).not.toContainEqual(expect.objectContaining({ id: "d2" }));
  });
});

// ─── filterVisiblePhotos ──────────────────────────────────────────────────────

describe("filterVisiblePhotos", () => {
  const photos: PortalPhoto[] = [
    { id: "p1", projectId: "proj-001", category: "before", visibility: "customer", caption: null, altText: null, takenAt: "", uploadedAt: "", url: "", thumbnailUrl: "", allowedRoles: null },
    { id: "p2", projectId: "proj-001", category: "during", visibility: "customer", caption: null, altText: null, takenAt: "", uploadedAt: "", url: "", thumbnailUrl: "", allowedRoles: ["gc"] },
    { id: "p3", projectId: "proj-001", category: "during", visibility: "internal", caption: null, altText: null, takenAt: "", uploadedAt: "", url: "", thumbnailUrl: "", allowedRoles: null },
  ];

  it("returns empty when photosEnabled is false", () => {
    expect(filterVisiblePhotos(photos, ["homeowner"], false)).toHaveLength(0);
  });

  it("homeowner sees all-roles customer photos", () => {
    const visible = filterVisiblePhotos(photos, ["homeowner"], true);
    expect(visible.map((p) => p.id)).toContain("p1");
    expect(visible.map((p) => p.id)).not.toContain("p3");
  });

  it("internal photos are never returned regardless of photosEnabled or role", () => {
    const visible = filterVisiblePhotos(photos, ["gc", "builder", "homeowner"], true);
    expect(visible).not.toContainEqual(expect.objectContaining({ id: "p3" }));
  });

  it("GC-restricted photo visible to GC, not homeowner (most-restrictive)", () => {
    const homeownerVisible = filterVisiblePhotos(photos, ["homeowner"], true);
    expect(homeownerVisible.map((p) => p.id)).not.toContain("p2");

    const gcVisible = filterVisiblePhotos(photos, ["gc"], true);
    expect(gcVisible.map((p) => p.id)).toContain("p2");
=======
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
>>>>>>> origin/main
  });
});
