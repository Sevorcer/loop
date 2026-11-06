/**
 * POST /api/jobs/[id]/return-pallet — a cancelled (or deleted) job's pallet goes back to the shop.
 * Body: { note?: string }.
 *
 * Roles: owner, manager, office (they write the ledger). The function checks the role too.
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapInventoryError, validationError } from "@/lib/api/inventoryRoute";
import { returnPallet } from "@/services/inventoryPulls";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(request, "inventory_transactions", "insert");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  let note: string | null = null;
  const raw = await request.text();
  if (raw.trim() !== "") {
    try {
      const body = JSON.parse(raw) as Record<string, unknown>;
      if (body.note !== undefined && body.note !== null) {
        if (typeof body.note !== "string" || body.note.length > 500) {
          return validationError("The note must be text of at most 500 characters.");
        }
        note = body.note.trim() || null;
      }
    } catch {
      return validationError("Send valid JSON.");
    }
  }

  try {
    return NextResponse.json(await returnPallet(id, note));
  } catch (error) {
    return mapInventoryError(error);
  }
}
