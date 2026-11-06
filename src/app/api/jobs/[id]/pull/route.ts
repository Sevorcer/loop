/**
 * POST /api/jobs/[id]/pull — move reserved stock from the shop to the job's pallet.
 * Body: { lineId?: string } — omit to pull the whole job. Safe to repeat: only claims still on
 * the shelf are moved.
 *
 * Roles: owner, manager, office (they write the ledger). The pull function checks the role too.
 */

import { NextResponse } from "next/server";

import { isUuid } from "@/features/inventory/utils/kitRules";
import { requirePermission } from "@/lib/api-auth";
import { mapInventoryError, validationError } from "@/lib/api/inventoryRoute";
import { pullMaterials } from "@/services/inventoryPulls";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(request, "inventory_transactions", "insert");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  let lineId: string | null = null;
  const raw = await request.text();
  if (raw.trim() !== "") {
    try {
      const body = JSON.parse(raw) as Record<string, unknown>;
      if (body.lineId !== undefined && body.lineId !== null) {
        if (!isUuid(body.lineId)) return validationError("Pick a line from the list.");
        lineId = body.lineId;
      }
    } catch {
      return validationError("Send valid JSON.");
    }
  }

  try {
    return NextResponse.json(await pullMaterials(id, lineId));
  } catch (error) {
    return mapInventoryError(error);
  }
}
