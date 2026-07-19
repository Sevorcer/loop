import type {
  PortalRole,
  PortalUser,
  PortalDocument,
  PortalPhoto,
  PortalPermissions,
  AuthzResult,
  AuthzErrorCode,
} from "../types/portalTypes";

// ─── Role Resolution ──────────────────────────────────────────────────────────

/**
 * Resolve the effective roles a user holds for a given org/project.
 *
 * Rules:
 * 1. Evaluate org membership (tenancy boundary)
 * 2. Resolve applicable roles for this org
 * 3. Filter by project access (if projectIds is non-empty, must include projectId)
 */
export function resolveEffectiveRoles(
  user: PortalUser,
  orgId: string,
  projectId: string
): { roles: PortalRole[]; membershipActive: boolean } {
  const membership = user.memberships.find((m) => m.orgId === orgId);
  if (!membership) return { roles: [], membershipActive: false };

  if (!membership.active) return { roles: [], membershipActive: false };

  // If projectIds is non-empty, the user must be explicitly listed for this project
  if (
    membership.projectIds.length > 0 &&
    !membership.projectIds.includes(projectId)
  ) {
    return { roles: [], membershipActive: true };
  }

  return { roles: membership.roles, membershipActive: true };
}

// ─── Permission Derivation ────────────────────────────────────────────────────

/**
 * Derive the full permission set for a union of roles.
 *
 * Resource visibility is additive (union) across roles.
 * Deny rules are hard blocks regardless of role count.
 */
export function derivePermissions(roles: PortalRole[]): PortalPermissions {
  const has = (role: PortalRole) => roles.includes(role);
  const isHomeowner = has("homeowner");
  const isGC = has("gc");
  const isBuilder = has("builder");
  const isPropertyManager = has("property_manager");

  return {
    canViewTimeline: isHomeowner || isGC || isBuilder,
    canViewDocuments: isHomeowner || isGC || isBuilder || isPropertyManager,
    canViewPhotos: isHomeowner || isGC || isBuilder, // photosEnabled also required per-project
    canViewChangeOrders: isHomeowner || isGC || isBuilder,
    canViewAppointments: isHomeowner || isGC || isBuilder,
    canViewContact: isHomeowner || isGC || isBuilder || isPropertyManager,
    canViewMilestoneDetails: isGC || isBuilder,
    canViewInspectionStatus: isGC || isBuilder,
    canViewPortfolio: isGC || isBuilder || isPropertyManager,
    canViewInstalledEquipment: isPropertyManager,
    canViewWarranties: isHomeowner || isPropertyManager,
    canViewMaintenanceRecords: isPropertyManager,
    canAcknowledgeChangeOrder: isHomeowner,
  };
}

// ─── Authorization Check ──────────────────────────────────────────────────────

export interface AuthzInput {
  user: PortalUser;
  orgId: string;
  projectId: string;
  projectExists: boolean;
  inviteActive: boolean;
}

/**
 * Run the full authorization decision flow as defined in the error-state
 * decision tree (error-state-catalog.md).
 *
 * Resolution order:
 * 1. Org membership (tenancy boundary)
 * 2. Invitation validity
 * 3. Membership active / not revoked
 * 4. Project exists
 * 5. Grant access + compute permissions
 */
export function checkAuthorization(input: AuthzInput): AuthzResult {
  const { user, orgId, projectId, projectExists, inviteActive } = input;

  const membership = user.memberships.find((m) => m.orgId === orgId);

  if (!membership) {
    return { granted: false, errorCode: "unauthorized", effectiveRoles: [], permissions: null };
  }

  if (!inviteActive) {
    return { granted: false, errorCode: "invite_expired", effectiveRoles: [], permissions: null };
  }

  if (!membership.active) {
    return { granted: false, errorCode: "access_revoked", effectiveRoles: [], permissions: null };
  }

  if (!projectExists) {
    return { granted: false, errorCode: "project_not_found", effectiveRoles: [], permissions: null };
  }

  const { roles } = resolveEffectiveRoles(user, orgId, projectId);

  if (roles.length === 0) {
    return { granted: false, errorCode: "unauthorized", effectiveRoles: [], permissions: null };
  }

  // Apply deny rules: no internal permissions can be accumulated
  const externalRoles = roles.filter((r): r is PortalRole =>
    ["homeowner", "gc", "builder", "property_manager"].includes(r)
  );

  const permissions = derivePermissions(externalRoles);

  return {
    granted: true,
    errorCode: null,
    effectiveRoles: externalRoles,
    permissions,
  };
}

// ─── Document Visibility Filter ───────────────────────────────────────────────

/**
 * Filter documents visible to the given roles.
 *
 * Rules (most-restrictive wins for documents):
 * 1. Internal documents are never returned
 * 2. If allowedRoles is null, all roles with canViewDocuments may access
 * 3. If allowedRoles is set, the user must hold at least one listed role
 */
export function filterVisibleDocuments(
  documents: PortalDocument[],
  effectiveRoles: PortalRole[]
): PortalDocument[] {
  return documents.filter((doc) => {
    // Deny rule: internal documents are hard-blocked
    if (doc.visibility === "internal") return false;

    // If no role restriction, all permitted roles may view
    if (doc.allowedRoles === null) return true;

    // Most-restrictive: user must hold at least one allowed role
    return doc.allowedRoles.some((r) => effectiveRoles.includes(r));
  });
}

// ─── Photo Visibility Filter ──────────────────────────────────────────────────

/**
 * Filter photos visible to the given roles.
 *
 * Rules:
 * 1. Internal photos are never returned (hard deny)
 * 2. photosEnabled must be true on the project level
 * 3. If allowedRoles is null, all roles with canViewPhotos may access
 * 4. If allowedRoles is set, the user must hold at least one listed role (most-restrictive)
 */
export function filterVisiblePhotos(
  photos: PortalPhoto[],
  effectiveRoles: PortalRole[],
  photosEnabled: boolean
): PortalPhoto[] {
  if (!photosEnabled) return [];

  return photos.filter((photo) => {
    // Deny rule: internal photos are hard-blocked
    if (photo.visibility === "internal") return false;

    // If no role restriction, all permitted roles may view
    if (photo.allowedRoles === null) return true;

    // Most-restrictive: user must hold at least one allowed role
    return photo.allowedRoles.some((r) => effectiveRoles.includes(r));
  });
}

// ─── Error Code to Error State Mapping ───────────────────────────────────────

export type PortalErrorState = {
  code: AuthzErrorCode;
  heading: string;
  body: string;
  primaryCTA: string;
  primaryCTAHref: string;
  secondaryCTA: string | null;
  telemetryEvent: string;
};

export function getErrorState(code: AuthzErrorCode): PortalErrorState {
  switch (code) {
    case "unauthorized":
      return {
        code,
        heading: "You don't have access to this project.",
        body: "Your account isn't linked to this project. If you believe this is a mistake, contact your contractor or project manager.",
        primaryCTA: "Contact Contractor",
        primaryCTAHref: "/portal",
        secondaryCTA: "Return to Dashboard",
        telemetryEvent: "portal.error.unauthorized",
      };
    case "invite_expired":
      return {
        code,
        heading: "Your invitation has expired.",
        body: "This invitation link is no longer valid. Ask your contractor to send a new invitation.",
        primaryCTA: "Request New Invite",
        primaryCTAHref: "/portal",
        secondaryCTA: "Contact Contractor",
        telemetryEvent: "portal.error.invite_expired",
      };
    case "access_revoked":
      return {
        code,
        heading: "Your access has been removed.",
        body: "Your contractor has removed your access to this project. If you have questions, contact them directly.",
        primaryCTA: "Contact Contractor",
        primaryCTAHref: "/portal",
        secondaryCTA: null,
        telemetryEvent: "portal.error.access_revoked",
      };
    case "project_not_found":
      return {
        code,
        heading: "This project isn't available.",
        body: "This project no longer exists or has been archived. Contact your contractor if you think this is a mistake.",
        primaryCTA: "Return to Dashboard",
        primaryCTAHref: "/portal",
        secondaryCTA: "Contact Contractor",
        telemetryEvent: "portal.error.project_not_found",
      };
    case "service_unavailable":
      return {
        code,
        heading: "LOOP is temporarily unavailable.",
        body: "We're working on it. Please try again in a few minutes. If this continues, contact support.",
        primaryCTA: "Try Again",
        primaryCTAHref: "#",
        secondaryCTA: "Contact Support",
        telemetryEvent: "portal.error.service_unavailable",
      };
  }
}
