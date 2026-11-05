/**
 * Price tiers for a sellable item (flat-rate tiers; sell prices only)
 *
 * GET /api/inventory/items/[id]/tiers — list
 * PUT /api/inventory/items/[id]/tiers — save `tiers`: inserts new labels, updates existing ones
 *     (removing a tier is DELETE /tiers/[tierId], owner only)
 *
 * Roles: catalog_price_tiers select (all internal) / update (owner, manager, office).
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapInventoryError, validationError } from "@/lib/api/inventoryRoute";
import { invalidJsonResponse, readJsonObject } from "@/lib/api/routeErrors";
import { parseTierPayload } from "@/features/inventory/utils/itemPayload";
import { listPriceTiers, savePriceTiers } from "@/services/inventoryCatalog";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(request, "catalog_price_tiers", "select");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  try {
    return NextResponse.json({ tiers: await listPriceTiers(id) });
  } catch (error) {
    return mapInventoryError(error);
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(request, "catalog_price_tiers", "update");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    return invalidJsonResponse();
  }

  const parsed = parseTierPayload(body);
  if (parsed.problems.length > 0) return validationError(parsed.problems.join(" "));

  try {
    return NextResponse.json({ tiers: await savePriceTiers(id, parsed.value) });
  } catch (error) {
    return mapInventoryError(error);
  }
}
