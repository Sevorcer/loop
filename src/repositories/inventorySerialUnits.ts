import "server-only";

import type {
  SerialReviewReason,
  SerialReviewRow,
  SerialUnit,
  SerialUnitFilters,
  SerialUnitSource,
  SerialUnitStatus,
} from "@/features/inventory/types/serials";
import { sanitizeSearchTerm, throwInventoryDbError } from "./inventoryErrors";
import { getRepositoryContext } from "./supabaseContext";

interface SerialUnitRow {
  id: string;
  item_id: string | null;
  manufacturer: string;
  model_number: string;
  serial_number: string;
  status: string;
  location_id: string | null;
  installed_system_id: string | null;
  source: string;
  needs_review: boolean;
  review_reason: string | null;
  created_at: string;
  updated_at: string;
}

interface ReviewRow {
  reason: string;
  serial_unit_id: string | null;
  installed_system_id: string | null;
  manufacturer: string | null;
  model_number: string | null;
  serial_number: string | null;
}

const UNIT_COLUMNS =
  "id,item_id,manufacturer,model_number,serial_number,status,location_id,installed_system_id,source,needs_review,review_reason,created_at,updated_at";

const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 2000;

function mapUnit(row: SerialUnitRow): SerialUnit {
  return {
    id: row.id,
    itemId: row.item_id,
    manufacturer: row.manufacturer,
    modelNumber: row.model_number,
    serialNumber: row.serial_number,
    status: row.status as SerialUnitStatus,
    locationId: row.location_id,
    installedSystemId: row.installed_system_id,
    source: row.source as SerialUnitSource,
    needsReview: row.needs_review,
    reviewReason: row.review_reason === "duplicate_serial" ? "duplicate_serial" : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapReview(row: ReviewRow): SerialReviewRow {
  return {
    reason: row.reason as SerialReviewReason,
    serialUnitId: row.serial_unit_id,
    installedSystemId: row.installed_system_id,
    manufacturer: row.manufacturer ?? "",
    modelNumber: row.model_number ?? "",
    serialNumber: row.serial_number,
  };
}

function clampLimit(limit: number | undefined): number {
  if (!limit || !Number.isFinite(limit) || limit < 1) return DEFAULT_LIMIT;
  return Math.min(Math.floor(limit), MAX_LIMIT);
}

export async function listSerialUnits(filters: SerialUnitFilters = {}): Promise<SerialUnit[]> {
  const { supabase, orgId } = await getRepositoryContext();
  let query = supabase
    .from("inventory_serial_units")
    .select(UNIT_COLUMNS)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .limit(clampLimit(filters.limit));

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.itemId) query = query.eq("item_id", filters.itemId);
  if (filters.locationId) query = query.eq("location_id", filters.locationId);
  if (filters.installedSystemId) query = query.eq("installed_system_id", filters.installedSystemId);
  if (filters.needsReview !== undefined) query = query.eq("needs_review", filters.needsReview);
  if (filters.search) {
    const term = sanitizeSearchTerm(filters.search);
    if (term) query = query.or(`serial_number.ilike.%${term}%,model_number.ilike.%${term}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as SerialUnitRow[]).map(mapUnit);
}

export async function getSerialUnit(id: string): Promise<SerialUnit | null> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("inventory_serial_units")
    .select(UNIT_COLUMNS)
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapUnit(data as SerialUnitRow) : null;
}

/** Everything the office must look at: flagged duplicates and systems with no usable serial. */
export async function listSerialReviewQueue(limit?: number): Promise<SerialReviewRow[]> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("inventory_serial_review_queue")
    .select("reason,serial_unit_id,installed_system_id,manufacturer,model_number,serial_number")
    .eq("org_id", orgId)
    .order("manufacturer", { ascending: true })
    .limit(clampLimit(limit));
  if (error) throw new Error(error.message);
  return ((data ?? []) as ReviewRow[]).map(mapReview);
}

/**
 * Marks a flagged unit as the real holder of its serial. The unique index
 * allows only one unflagged unit per (org, manufacturer, serial), so this
 * conflicts (409) while another unit already holds it.
 */
export async function clearSerialUnitReview(id: string): Promise<SerialUnit | null> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("inventory_serial_units")
    .update({ needs_review: false, review_reason: null })
    .eq("org_id", orgId)
    .eq("id", id)
    .eq("needs_review", true)
    .select(UNIT_COLUMNS)
    .maybeSingle();
  if (error) {
    throwInventoryDbError(error, "Another unit already holds this serial. Resolve that one first.");
  }
  return data ? mapUnit(data as SerialUnitRow) : null;
}

export interface NewReceivedUnit {
  itemId: string;
  locationId: string;
  manufacturer: string;
  modelNumber: string;
  serialNumber: string;
}

/**
 * Creates one in-stock unit per received serial in a single statement, so a clash
 * (409) leaves nothing behind. The unique index refuses a serial that another
 * unflagged unit already holds for the same manufacturer.
 */
export async function createReceivedUnits(units: readonly NewReceivedUnit[], userId: string): Promise<SerialUnit[]> {
  if (units.length === 0) return [];
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("inventory_serial_units")
    .insert(
      units.map((unit) => ({
        org_id: orgId,
        item_id: unit.itemId,
        location_id: unit.locationId,
        manufacturer: unit.manufacturer,
        model_number: unit.modelNumber,
        serial_number: unit.serialNumber,
        status: "in_stock",
        source: "receipt",
        created_by: userId,
      })),
    )
    .select(UNIT_COLUMNS);
  if (error) {
    throwInventoryDbError(error, "One of these serial numbers is already on file. Check the nameplate, or resolve the existing unit in Serials.");
  }
  return ((data ?? []) as SerialUnitRow[]).map(mapUnit);
}

/** Best-effort undo of units created for a receipt whose ledger post then failed. Only the owner role may delete. */
export async function discardUnits(ids: readonly string[]): Promise<boolean> {
  if (ids.length === 0) return true;
  const { supabase, orgId } = await getRepositoryContext();
  const { error } = await supabase.from("inventory_serial_units").delete().eq("org_id", orgId).in("id", [...ids]);
  return !error;
}

/**
 * Scraps a detached unit (installed, on no system, not part of a duplicate group).
 * Returns null when the unit is not in that state, so a stale click changes nothing.
 */
export async function scrapDetachedUnit(id: string): Promise<SerialUnit | null> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("inventory_serial_units")
    .update({ status: "scrapped" })
    .eq("org_id", orgId)
    .eq("id", id)
    .eq("status", "installed")
    .is("installed_system_id", null)
    .eq("needs_review", false)
    .select(UNIT_COLUMNS)
    .maybeSingle();
  if (error) throwInventoryDbError(error);
  return data ? mapUnit(data as SerialUnitRow) : null;
}
