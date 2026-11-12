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

export type SerialReviewReason = "duplicate_serial" | "missing_serial" | "detached_unit";

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

/**
 * What the office can do with one review row. keep, correct and remove settle a flagged
 * duplicate; scrap settles a detached unit (one whose serial was taken off its system).
 */
export const SERIAL_REVIEW_ACTIONS = ["keep", "correct", "remove", "scrap"] as const;
export type SerialReviewAction = (typeof SERIAL_REVIEW_ACTIONS)[number];

export interface SerialReviewCommand {
  action: SerialReviewAction;
  /** Required for "correct": the serial that is actually on the nameplate. */
  serialNumber?: string;
}

/** A unit picked for a material line (job_material_line_serials joined to its unit). */
export interface LineSerialPick {
  lineId: string;
  serialUnitId: string;
  serialNumber: string;
  locationId: string | null;
  status: SerialUnitStatus;
}

/**
 * RMA: a unit that fails or comes back leaves service through quarantine.
 *   quarantine          a unit in stock or installed goes to a quarantine location
 *   return_to_supplier  a quarantined unit leaves stock, sent back
 *   repair              a quarantined unit is fixed and goes back into stock at `locationId`
 *   scrap               a quarantined unit is written off
 */
export const RMA_ACTIONS = ["quarantine", "return_to_supplier", "repair", "scrap"] as const;
export type RmaAction = (typeof RMA_ACTIONS)[number];

export interface RmaCommand {
  action: RmaAction;
  /** repair: where the unit goes back to. quarantine: a specific quarantine location (optional). */
  locationId?: string;
  /** Carried on the ledger entry. */
  note?: string;
}
