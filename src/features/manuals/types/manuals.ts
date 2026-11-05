/**
 * Drive manual index types (#33).
 *
 * Google Drive is the source of truth. Loop stores only metadata + a link
 * for each file, plus a manufacturer / model / document-type guess parsed
 * from the file name (and folder path).
 */

export const MANUAL_DOC_TYPES = [
  "install",
  "iom",
  "service",
  "user",
  "spec_sheet",
  "quick_reference",
  "field_reference",
  "guide",
  "wiring",
  "form",
  "other",
] as const;

export type ManualDocType = (typeof MANUAL_DOC_TYPES)[number];

export const MANUAL_DOC_TYPE_LABELS: Record<ManualDocType, string> = {
  install: "Install manual",
  iom: "Install / operation / maintenance",
  service: "Service manual",
  user: "User manual",
  spec_sheet: "Spec sheet",
  quick_reference: "Quick reference",
  field_reference: "Field reference",
  guide: "Guide",
  wiring: "Wiring diagram",
  form: "Form / template",
  other: "Other",
};

export type DriveManualStatus = "active" | "removed";

export interface ParsedManualName {
  /** Best single manufacturer (first found), or null. */
  manufacturer: string | null;
  /** Every manufacturer named in the file name / folder path. */
  manufacturers: string[];
  /** Model-number-like tokens, uppercased as written (e.g. "MSZ-GL09NA"). */
  models: string[];
  docType: ManualDocType;
}

/** One indexed Drive file, as returned by the API. */
export interface DriveManualFile {
  id: string;
  driveFileId: string;
  name: string;
  mimeType: string;
  folderPath: string;
  driveModifiedAt: string | null;
  webViewLink: string;
  sizeBytes: number | null;
  parsedManufacturer: string | null;
  parsedManufacturers: string[];
  parsedModels: string[];
  docType: ManualDocType;
  manufacturerOverride: string | null;
  modelOverride: string | null;
  /** Override when set, otherwise the parsed value. */
  manufacturer: string | null;
  models: string[];
  status: DriveManualStatus;
  /**
   * True when the file sits in the "Customer manuals" Drive folder (shared
   * anyone-with-the-link), so the builder portal may link to it.
   */
  portalEligible: boolean;
  lastSeenAt: string;
  updatedAt: string;
}

/** A file as read from the Drive API, before it is written to the index. */
export interface DriveListedFile {
  driveFileId: string;
  name: string;
  mimeType: string;
  folderPath: string;
  rootFolderId: string;
  parentFolderId: string | null;
  modifiedTime: string | null;
  webViewLink: string;
  sizeBytes: number | null;
  /** Directly inside the Customer manuals folder (never via a shortcut). */
  portalEligible: boolean;
}

export interface DriveManualSyncRun {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: "running" | "ok" | "error";
  folderCount: number;
  filesSeen: number;
  filesAdded: number;
  filesUpdated: number;
  filesRemoved: number;
  error: string | null;
}

export interface DriveManualsConfigStatus {
  /** True once every required env var is present. */
  configured: boolean;
  /** Names (never values) of the env vars still missing. */
  missing: string[];
  folderCount: number;
  serviceAccountEmail: string | null;
  /** True when GOOGLE_DRIVE_CUSTOMER_MANUALS_FOLDER_ID is set (optional). */
  customerFolderConfigured: boolean;
}

export interface DriveManualsSnapshot {
  files: DriveManualFile[];
  config: DriveManualsConfigStatus;
  lastRun: DriveManualSyncRun | null;
  canManage: boolean;
}

// ─── #32 Installed system ↔ manual links ─────────────────────────────────────

export type ManualMatchKind = "model_exact" | "model_family" | "manufacturer" | "manual";
export type ManualLinkStatus = "confirmed" | "rejected" | "auto_linked" | "suggested";
export type ManualLinkSource = "office" | "copilot";
export type MatchConfidenceLevel = "high" | "medium" | "low";

/** A live match from the matcher (not yet a stored decision). */
export interface ManualMatch {
  manualId: string;
  kind: ManualMatchKind;
  /** 0..1 */
  confidence: number;
  level: MatchConfidenceLevel;
  /** Plain-English reason, e.g. "Model MSZ-GL09NA is in the file name". */
  reason: string;
}

/** What the matcher needs from an installed system. */
export interface ManualMatchSubject {
  manufacturer: string | null | undefined;
  modelNumber: string | null | undefined;
  systemName?: string | null;
}

/** A manual shown on an installed system: stored decision or live suggestion. */
export interface InstalledSystemManual {
  manual: Pick<DriveManualFile, "id" | "name" | "webViewLink" | "docType" | "manufacturer" | "models" | "folderPath" | "mimeType" | "status" | "portalEligible">;
  status: ManualLinkStatus | "match";
  source: ManualLinkSource | "live";
  kind: ManualMatchKind;
  confidence: number;
  level: MatchConfidenceLevel;
  reason: string;
  decidedAt: string | null;
}

export interface SystemPlacementJob {
  id: string;
  jobNumber: string;
  title: string;
  type: string;
  status: string;
  scheduledFor: string | null;
  /** linked = installed_systems.job_id; inferred = same-property install job. */
  basis: "linked" | "install_date" | "latest_install";
}

/** "Auto-placed" info: where the record's facts came from. */
export interface SystemPlacement {
  nameplate: Array<{ label: string; value: string }>;
  recordFields: Array<{ label: string; value: string }>;
  job: SystemPlacementJob | null;
}

export interface InstalledSystemManualsView {
  systemId: string;
  linked: InstalledSystemManual[];
  suggestions: InstalledSystemManual[];
  rejectedCount: number;
  placement: SystemPlacement;
  canManage: boolean;
  /** Active manuals for the manual "link another" picker (office only). */
  library: Array<{ id: string; name: string; manufacturer: string | null }>;
  driveConnected: boolean;
}
