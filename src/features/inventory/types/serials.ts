/**
 * Serialized units (Inventory Lane 3).
 *
 * inventory_serial_units is the single serial truth. installed_systems keeps a
 * mirrored serial_numbers list, rebuilt from the units, so older readers keep working.
 */

export const SERIAL_UNIT_STATUSES = [
  "in_stock",
  "installed",
  "quarantine",
  "returned_to_supplier",
  "scrapped",
] as const;
export type SerialUnitStatus = (typeof SERIAL_UNIT_STATUSES)[number];

export const SERIAL_UNIT_SOURCES = ["receipt", "scan", "manual", "backfill", "sync"] as const;
export type SerialUnitSource = (typeof SERIAL_UNIT_SOURCES)[number];

export type SerialReviewReason = "duplicate_serial" | "missing_serial";

export interface SerialUnit {
  id: string;
  itemId: string | null;
  manufacturer: string;
  modelNumber: string;
  serialNumber: string;
  status: SerialUnitStatus;
  locationId: string | null;
  installedSystemId: string | null;
  source: SerialUnitSource;
  needsReview: boolean;
  reviewReason: "duplicate_serial" | null;
  createdAt: string;
  updatedAt: string;
}

/** One row of the office review queue. */
export interface SerialReviewRow {
  reason: SerialReviewReason;
  serialUnitId: string | null;
  installedSystemId: string | null;
  manufacturer: string;
  modelNumber: string;
  serialNumber: string | null;
}

export interface SerialUnitFilters {
  status?: SerialUnitStatus;
  itemId?: string;
  locationId?: string;
  installedSystemId?: string;
  needsReview?: boolean;
  /** Matches serial number or model (case-insensitive, partial). */
  search?: string;
  limit?: number;
}

/** What the office can do with one flagged duplicate row. */
export const SERIAL_REVIEW_ACTIONS = ["keep", "correct", "remove"] as const;
export type SerialReviewAction = (typeof SERIAL_REVIEW_ACTIONS)[number];

export interface SerialReviewCommand {
  action: SerialReviewAction;
  /** Required for "correct": the serial that is actually on the nameplate. */
  serialNumber?: string;
}
