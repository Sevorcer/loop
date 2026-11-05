/**
 * GC Portal types — Task 2 + v2
 *
 * Types for the builder-facing portal view.
 * Re-exports portal job data types from the service layer.
 */

export type {
  PortalJobData,
  PortalTimelineEvent,
  PortalPhoto,
  PortalDocument,
  PortalMoneyData,
  PortalChangeOrder,
  PortalPermit,
  PortalInspection,
  PortalMilestone,
  PortalEstimate,
  PortalBilling,
  PortalChangeOrderV2,
} from "@/services/portalJobData";
