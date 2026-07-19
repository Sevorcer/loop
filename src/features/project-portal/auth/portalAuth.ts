import type {
  AuthorizationResult,
  PortalOrgMembership,
  PortalPermissionSet,
  PortalProject,
  PortalRole,
  PortalUser,
} from "../types/portal";

// ─── Role-to-Permission Map ───────────────────────────────────────────────────
// Defines base permissions for each single role.
// Additive union is applied when multiple roles are held.

const ROLE_PERMISSIONS: Record<PortalRole, PortalPermissionSet> = {
  homeowner: {
    canViewOverview: true,
    canViewTimeline: true,
    canViewDocuments: true,
    canDownloadDocuments: true,
    canViewPhotos: true, // if enabled per-project
    canViewChangeOrders: true,
    canViewAppointments: true,
    canViewContactTeam: true,
    canViewMilestoneDetails: false,
    canViewInspectionStatus: false,
    canViewPortfolio: false,
    canViewInstalledEquipment: false,
    canViewWarrantyRecords: true,
    canViewMaintenanceRecords: false,
    canViewServiceHistory: false,
    canViewInternalData: false,
  },
  general_contractor: {
    canViewOverview: true,
    canViewTimeline: true,
    canViewDocuments: true,
    canDownloadDocuments: true,
    canViewPhotos: true, // if enabled per-project
    canViewChangeOrders: true,
    canViewAppointments: true,
    canViewContactTeam: true,
    canViewMilestoneDetails: true,
    canViewInspectionStatus: true,
    canViewPortfolio: true,
    canViewInstalledEquipment: false,
    canViewWarrantyRecords: false,
    canViewMaintenanceRecords: false,
    canViewServiceHistory: false,
    canViewInternalData: false,
  },
  builder_developer: {
    canViewOverview: true,
    canViewTimeline: true,
    canViewDocuments: true,
    canDownloadDocuments: true,
    canViewPhotos: true, // if enabled per-project
    canViewChangeOrders: true,
    canViewAppointments: true,
    canViewContactTeam: true,
    canViewMilestoneDetails: true,
    canViewInspectionStatus: true,
    canViewPortfolio: true,
    canViewInstalledEquipment: false,
    canViewWarrantyRecords: false,
    canViewMaintenanceRecords: false,
    canViewServiceHistory: false,
    canViewInternalData: false,
  },
  property_manager: {
    canViewOverview: true,
    canViewTimeline: false,
    canViewDocuments: true,
    canDownloadDocuments: true,
    canViewPhotos: false,
    canViewChangeOrders: false,
    canViewAppointments: false,
    canViewContactTeam: true,
    canViewMilestoneDetails: false,
    canViewInspectionStatus: false,
    canViewPortfolio: true,
    canViewInstalledEquipment: true,
    canViewWarrantyRecords: true,
    canViewMaintenanceRecords: true,
    canViewServiceHistory: true,
    canViewInternalData: false,
  },
};

// ─── Union (additive) merge ───────────────────────────────────────────────────

/**
 * Merges permissions from multiple roles by logical OR (additive union).
 * canViewInternalData is always false — no external role can acquire it.
 */
export function mergePermissions(roles: PortalRole[]): PortalPermissionSet {
  const base: PortalPermissionSet = {
    canViewOverview: false,
    canViewTimeline: false,
    canViewDocuments: false,
    canDownloadDocuments: false,
    canViewPhotos: false,
    canViewChangeOrders: false,
    canViewAppointments: false,
    canViewContactTeam: false,
    canViewMilestoneDetails: false,
    canViewInspectionStatus: false,
    canViewPortfolio: false,
    canViewInstalledEquipment: false,
    canViewWarrantyRecords: false,
    canViewMaintenanceRecords: false,
    canViewServiceHistory: false,
    canViewInternalData: false, // always false — hard deny
  };

  for (const role of roles) {
    const perms = ROLE_PERMISSIONS[role];
    (Object.keys(base) as (keyof PortalPermissionSet)[]).forEach((key) => {
      if (key === "canViewInternalData") return; // never grant
      if (perms[key]) {
        (base as unknown as Record<string, boolean>)[key] = true;
      }
    });
  }

  return base;
}

// ─── Role Resolution ──────────────────────────────────────────────────────────

/**
 * Resolves the applicable organization membership for a given org.
 * Returns null if the user is not a member of the organization.
 *
 * Rule: organization boundaries are always enforced (TB-1 through TB-6).
 */
export function resolveMembership(
  user: PortalUser,
  organizationId: string,
): PortalOrgMembership | null {
  return (
    user.memberships.find((m) => m.organizationId === organizationId) ?? null
  );
}

// ─── Authorization ────────────────────────────────────────────────────────────

/**
 * Authorizes a portal user's access to a specific project.
 *
 * Resolution order (per authorization-matrix.md):
 *   1. Evaluate organization membership (tenancy boundary)
 *   2. Check invitation expiry
 *   3. Check revocation status
 *   4. Resolve roles for this organization
 *   5. Apply deny rules (internal data — always hard blocked)
 *   6. Return merged permission set
 */
export function authorizePortalAccess(
  user: PortalUser,
  project: PortalProject,
): AuthorizationResult {
  const membership = resolveMembership(user, project.organizationId);

  // Step 1: Organization membership check
  if (!membership) {
    return { ok: false, errorCode: "unauthorized" };
  }

  // Step 2: Invitation expiry check
  if (membership.inviteExpiresAt !== null) {
    const expiry = new Date(membership.inviteExpiresAt);
    if (expiry < new Date()) {
      return { ok: false, errorCode: "expired_invite" };
    }
  }

  // Step 3: Revocation check
  if (membership.isRevoked) {
    return { ok: false, errorCode: "revoked_access" };
  }

  // Steps 4–6: Role resolution + permission merge
  const permissionSet = mergePermissions(membership.roles);

  return {
    ok: true,
    permissionSet,
    resolvedRoles: membership.roles,
  };
}

// ─── Project Access Check ─────────────────────────────────────────────────────

/**
 * Verifies that a user has any access at all to a given organization.
 * Used for org isolation — never returns cross-org data.
 *
 * Enforces TB-6: no cross-organization data may appear regardless of query params.
 */
export function hasOrgAccess(user: PortalUser, organizationId: string): boolean {
  const membership = resolveMembership(user, organizationId);
  if (!membership) return false;
  if (membership.isRevoked) return false;
  if (membership.inviteExpiresAt !== null) {
    return new Date(membership.inviteExpiresAt) >= new Date();
  }
  return true;
}

/**
 * Returns all projects accessible to the user within their active org memberships.
 * Never returns projects from orgs the user is not a member of.
 */
export function getAccessibleProjects(
  user: PortalUser,
  allProjects: PortalProject[],
): PortalProject[] {
  const activeOrgIds = user.memberships
    .filter((m) => !m.isRevoked)
    .filter(
      (m) =>
        m.inviteExpiresAt === null || new Date(m.inviteExpiresAt) >= new Date(),
    )
    .map((m) => m.organizationId);

  return allProjects.filter((p) => activeOrgIds.includes(p.organizationId));
}

// ─── Document Visibility Filter ───────────────────────────────────────────────

/**
 * Document visibility filter — most restrictive wins.
 *
 * Per authorization-matrix.md Rule 2: when role visibility rules conflict
 * on a specific document, the most restrictive rule wins.
 *
 * For MVP: only "customer" visibility documents are ever returned.
 * Internal documents are denied regardless of role.
 *
 * @param permissionSet resolved permission set for the user
 * @param documentVisibility the visibility tag on the document
 */
export function canViewDocument(
  permissionSet: PortalPermissionSet,
  documentVisibility: "customer" | "internal",
): boolean {
  if (documentVisibility === "internal") return false; // hard deny
  return permissionSet.canViewDocuments;
}
