<<<<<<< HEAD
// ─── Types ────────────────────────────────────────────────────────────────────
export type * from "./types/portalTypes";

// ─── Screens ──────────────────────────────────────────────────────────────────
export { PortalOverviewScreen } from "./screens/PortalOverviewScreen";
export { PortalTimelineScreen } from "./screens/PortalTimelineScreen";
export { PortalDocumentsScreen } from "./screens/PortalDocumentsScreen";
export { PortalContactScreen } from "./screens/PortalContactScreen";
export { PortalPhotosScreen } from "./screens/PortalPhotosScreen";
export { PortalNotificationsScreen } from "./screens/PortalNotificationsScreen";

// ─── State ────────────────────────────────────────────────────────────────────
export { PortalProvider, usePortal } from "./state/PortalProvider";

// ─── Components ───────────────────────────────────────────────────────────────
export { PortalShell } from "./components/PortalShell";
export { StaleBanner } from "./components/StaleBanner";
export { PortalErrorDisplay, PortalEmptyState, PortalLoadingState } from "./components/PortalErrorState";
export { PhotoGallery } from "./components/PhotoGallery";
export { NotificationPreferencesPanel } from "./components/NotificationPreferences";
=======
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
>>>>>>> origin/main
