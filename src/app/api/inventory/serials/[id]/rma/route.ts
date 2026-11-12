/**
 * POST /api/inventory/serials/[id]/rma — send a unit through quarantine
 *
 * Body: { action: "quarantine" | "return_to_supplier" | "repair" | "scrap", locationId?, note? }
 *   quarantine          a unit in stock or installed goes to quarantine (locationId: a quarantine
 *                       location; omit to use the org's, which is created if there is none)
 *   repair              a quarantined unit goes back into stock at locationId
 *   return_to_supplier  a quarantined unit leaves stock
 *   scrap               a quarantined unit is written off
 *
 * Roles: inventory_serial_units update (owner, manager, office); the database function checks again.
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapInventoryError } from "@/lib/api/inventoryRoute";
import { invalidJsonResponse, readJsonObject } from "@/lib/api/routeErrors";
import { rmaSerialUnit } from "@/services/inventorySerialUnits";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(request, "inventory_serial_units", "update");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    return invalidJsonResponse();
  }

  try {
    return NextResponse.json({ unit: await rmaSerialUnit(id, body) });
  } catch (error) {
    return mapInventoryError(error);
  }
}
