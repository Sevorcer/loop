/**
 * Units picked for material lines (Inventory Lane 3).
 *
 * GET  /api/inventory/line-serials?lineIds=a,b — the units picked for those lines
 * POST /api/inventory/line-serials             — { lineId, serialUnitId } pick a unit for a line
 *
 * The link is the record of which unit a line uses; it is never derived from the ledger.
 * Roles: job_material_line_serials select (owner, manager, dispatch, tech, office); insert
 * (owner, manager, office). Techs read and never write picks.
 */

import { NextResponse } from "next/server";

import { isUuid } from "@/features/inventory/utils/kitRules";
import { requirePermission } from "@/lib/api-auth";
import { mapInventoryError, validationError } from "@/lib/api/inventoryRoute";
import { invalidJsonResponse, readJsonObject } from "@/lib/api/routeErrors";
import { listPicksForLines, pickUnitForLine } from "@/services/inventoryLineSerials";

const MAX_LINES = 200;

export async function GET(request: Request) {
  const guard = await requirePermission(request, "job_material_line_serials", "select");
  if (!guard.ok) return guard.response;

  const raw = new URL(request.url).searchParams.get("lineIds") ?? "";
  const lineIds = raw.split(",").map((id) => id.trim()).filter(Boolean);
  if (lineIds.length === 0) return validationError("lineIds is required.");
  if (lineIds.length > MAX_LINES || !lineIds.every(isUuid)) return validationError("lineIds must be a short list of line ids.");

  try {
    return NextResponse.json({ picks: await listPicksForLines(lineIds) });
  } catch (error) {
    return mapInventoryError(error);
  }
}

export async function POST(request: Request) {
  const guard = await requirePermission(request, "job_material_line_serials", "insert");
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    return invalidJsonResponse();
  }
  if (!isUuid(body.lineId)) return validationError("lineId is required.");
  if (!isUuid(body.serialUnitId)) return validationError("serialUnitId is required.");

  try {
    await pickUnitForLine(body.lineId, body.serialUnitId, guard.ctx.userId);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return mapInventoryError(error);
  }
}
