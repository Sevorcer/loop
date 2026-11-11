/**
 * GET /api/inventory/serials — list serial units
 *
 * Query: status, itemId, locationId, installedSystemId, needsReview=1|0, search, limit
 *
 * Roles: inventory_serial_units select (owner, manager, dispatch, office; tech sees
 * installed units and units at own van or the shop — row scope is RLS).
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapInventoryError, queryInt, validationError } from "@/lib/api/inventoryRoute";
import { SERIAL_UNIT_STATUSES, type SerialUnitFilters, type SerialUnitStatus } from "@/features/inventory/types/serials";
import { listSerialUnits } from "@/services/inventorySerialUnits";

export async function GET(request: Request) {
  const guard = await requirePermission(request, "inventory_serial_units", "select");
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const filters: SerialUnitFilters = {};

  const status = url.searchParams.get("status");
  if (status) {
    if (!(SERIAL_UNIT_STATUSES as readonly string[]).includes(status)) {
      return validationError(`status must be one of ${SERIAL_UNIT_STATUSES.join(", ")}.`);
    }
    filters.status = status as SerialUnitStatus;
  }
  const itemId = url.searchParams.get("itemId");
  if (itemId) filters.itemId = itemId;
  const locationId = url.searchParams.get("locationId");
  if (locationId) filters.locationId = locationId;
  const installedSystemId = url.searchParams.get("installedSystemId");
  if (installedSystemId) filters.installedSystemId = installedSystemId;
  const needsReview = url.searchParams.get("needsReview");
  if (needsReview === "1" || needsReview === "true") filters.needsReview = true;
  if (needsReview === "0" || needsReview === "false") filters.needsReview = false;
  const search = url.searchParams.get("search");
  if (search) filters.search = search;
  const limit = queryInt(url, "limit");
  if (limit) filters.limit = limit;

  try {
    return NextResponse.json({ units: await listSerialUnits(filters) });
  } catch (error) {
    return mapInventoryError(error);
  }
}
