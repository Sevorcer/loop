// ─── Types ────────────────────────────────────────────────────────────────────
export type * from "./types/portalTypes";

// ─── Screens ─────────────────────────────────────────────────────────────────
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
export { PortalNav } from "./components/PortalNav";
export { StaleBanner } from "./components/StaleBanner";
export { PortalErrorState, PortalErrorDisplay, PortalEmptyState, PortalLoadingState } from "./components/PortalErrorState";
export { PhotoGallery } from "./components/PhotoGallery";
export { NotificationPreferencesPanel } from "./components/NotificationPreferences";

// ─── Auth ────────────────────────────────────────────────────────────────────
export { authorizePortalAccess, mergePermissions, getAccessibleProjects, canViewDocument } from "./auth/portalAuth";

// ─── Adapters ────────────────────────────────────────────────────────────────
export { buildProjection, computeFreshness, deduplicateEvents } from "./adapters/eventProjection";
