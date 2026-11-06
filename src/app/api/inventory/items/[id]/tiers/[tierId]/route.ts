/**
 * DELETE /api/inventory/items/[id]/tiers/[tierId] — remove a price tier
 *
 * Roles: catalog_price_tiers delete — owner only.
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapInventoryError } from "@/lib/api/inventoryRoute";
import { removePriceTier } from "@/services/inventoryCatalog";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; tierId: string }> },
) {
  const guard = await requirePermission(request, "catalog_price_tiers", "delete");
  if (!guard.ok) return guard.response;
  const { id, tierId } = await params;

  try {
    await removePriceTier(id, tierId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return mapInventoryError(error);
  }
}
