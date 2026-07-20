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
export {
  PortalErrorState,
  PortalErrorDisplay,
  PortalEmptyState,
  PortalLoadingState,
} from "./components/PortalErrorState";
export { PhotoGallery } from "./components/PhotoGallery";
export { NotificationPreferencesPanel } from "./components/NotificationPreferences";

// ─── Auth ────────────────────────────────────────────────────────────────────
export {
  authorizePortalAccess,
  mergePermissions,
  getAccessibleProjects,
  canViewDocument,
} from "./auth/portalAuth";

// ─── Adapters ────────────────────────────────────────────────────────────────
export { buildProjection, computeFreshness, deduplicateEvents } from "./adapters/eventProjection";
export type {
  ChangeOrdersAdapter,
  ChangeOrdersProjectionRecord,
  DailyPlansAdapter,
  DailyPlansProjectionRecord,
  DispatchAdapter,
  DispatchProjectionRecord,
  DocumentsAdapter,
  DocumentsProjectionRecord,
  InstalledSystemsAdapter,
  InstalledSystemsProjectionRecord,
  JobsAdapter,
  JobsProjectionRecord,
  PhotosAdapter,
  PhotosProjectionRecord,
  PortalIntegrationSnapshot,
  PortalUpstreamAdapters,
  ReportingAdapter,
  ReportingProjectionRecord,
} from "./adapters/types";

// ─── Runtime ─────────────────────────────────────────────────────────────────
export {
  buildPortalFreshnessStatus,
  capturePortalCheckpoint,
  InMemoryPortalCheckpointStore,
  type PortalCheckpointStore,
  type PortalFreshnessPolicy,
} from "./runtime/checkpoints";
export {
  validatePortalEventEnvelope,
  type PortalEventValidationOptions,
} from "./runtime/eventValidation";
export {
  detectDuplicatePortalEvent,
  InMemoryPortalIdempotencyStore,
  type PortalDeduplicationResult,
  type PortalIdempotencyStore,
} from "./runtime/idempotency";
export {
  applyPortalEventToProjection,
  buildPortalProjectionState,
  collectPortalIntegrationSnapshot,
} from "./runtime/projection";
export {
  defaultPortalRolloutControl,
  InMemoryPortalTelemetrySink,
  StaticPortalRolloutControl,
  type PortalCapabilityFlag,
  type PortalLaunchGateKey,
  type PortalRolloutControl,
  type PortalTelemetryEvent,
  type PortalTelemetrySink,
} from "./runtime/rollout";
export {
  orderPortalEventsForReplay,
  rebuildPortalProjectionFromEvents,
  type PortalReplayHarnessOptions,
  type PortalReplayResult,
  type PortalReplayStep,
} from "./runtime/replayHarness";

// ─── Data + Contracts ────────────────────────────────────────────────────────
export { fakePortalEvents } from "./data/fakePortalArtifacts";
export type {
  PortalCanonicalEventType,
  PortalEventEnvelope,
  PortalEventValidationCode,
  PortalEventValidationError,
  PortalEventValidationResult,
  SupportedPortalEventVersion,
} from "./types/events";
export {
  PORTAL_CANONICAL_EVENT_TYPES,
  PORTAL_SUPPORTED_EVENT_VERSIONS,
} from "./types/events";
export type {
  PortalAppointmentSummary,
  PortalApprovedChangeOrder,
  PortalDocumentVisibility,
  PortalFreshnessStatus,
  PortalInstalledSystemSummary,
  PortalMetricSummary,
  PortalPublishedDocument,
  PortalPublishedPhoto,
  PortalProjectionCheckpoint,
  PortalProjectionFreshnessState,
  PortalProjectionState,
  PortalProjectOverview,
  PortalSourceDomain,
  PortalTimelineEntry,
} from "./types/integration";
