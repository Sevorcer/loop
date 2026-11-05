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
}

export interface DriveManualsSnapshot {
  files: DriveManualFile[];
  config: DriveManualsConfigStatus;
  lastRun: DriveManualSyncRun | null;
  canManage: boolean;
}
