export { createMockPortalAdapters } from "./adapters/mockAdapters";
export { createFakePortalAdapters } from "./adapters/fakeAdapters";
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
  PortalAppointment,
  PortalChangeOrder,
  PortalDocument,
  PortalDocumentVisibility,
  PortalFreshnessStatus,
  PortalInstalledSystemSummary,
  PortalMetricSummary,
  PortalProjectionCheckpoint,
  PortalProjectionFreshnessState,
  PortalProjectionState,
  PortalProjectOverview,
  PortalSourceDomain,
  PortalTimelineEntry,
} from "./types/portal";
