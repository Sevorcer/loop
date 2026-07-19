// ─── Project Portal — Sprint 22A ─────────────────────────────────────────────
// Public exports for the project-portal feature.

// State
export { PortalProvider, usePortal } from "./state/PortalProvider";

// Screens
export { ProjectOverviewScreen } from "./screens/ProjectOverviewScreen";
export { TimelineScreen } from "./screens/TimelineScreen";
export { DocumentsScreen } from "./screens/DocumentsScreen";
export { ContactTeamScreen } from "./screens/ContactTeamScreen";

// Components
export { StaleBanner } from "./components/StaleBanner";
export { PortalNav } from "./components/PortalNav";
export { PortalErrorState } from "./components/PortalErrorState";

// Auth
export { authorizePortalAccess, mergePermissions, getAccessibleProjects, canViewDocument } from "./auth/portalAuth";

// Adapters
export { buildProjection, computeFreshness, deduplicateEvents } from "./adapters/eventProjection";

// Types
export type {
  PortalRole,
  PortalUser,
  PortalOrgMembership,
  PortalPermissionSet,
  AuthorizationResult,
  AuthorizationErrorCode,
  PortalEventEnvelope,
  PortalEventType,
  PortalSourceDomain,
  PortalProject,
  FreshnessStatus,
  FreshnessState,
  PortalProjection,
  TimelineEntry,
  PortalDocument,
  PortalAppointment,
  PortalChangeOrder,
} from "./types/portal";
