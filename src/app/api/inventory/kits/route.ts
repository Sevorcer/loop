/**
 * Kit templates (Inventory Lane 4)
 *
 * GET  /api/inventory/kits — list (includeArchived=1 to include archived kits)
 * POST /api/inventory/kits — create a kit; body { name, description?, category?, lines? }
 *      or { name, copyFromId } to duplicate an existing kit
 *
 * Roles: kit_templates select (every internal role) / insert (owner, manager, office).
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapInventoryError, queryFlag, validationError } from "@/lib/api/inventoryRoute";
import { invalidJsonResponse, readJsonObject } from "@/lib/api/routeErrors";
import { createKit, listKits } from "@/services/kitTemplates";

export async function GET(request: Request) {
  const guard = await requirePermission(request, "kit_templates", "select");
  if (!guard.ok) return guard.response;

  try {
    const kits = await listKits(queryFlag(new URL(request.url), "includeArchived"));
    return NextResponse.json({ kits });
  } catch (error) {
    return mapInventoryError(error);
  }
}

export async function POST(request: Request) {
  const guard = await requirePermission(request, "kit_templates", "insert");
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    return invalidJsonResponse();
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return validationError("Send a JSON object.");

  try {
    const kit = await createKit({
      name: body.name,
      description: body.description,
      category: body.category,
      lines: body.lines,
      copyFromId: body.copyFromId,
    });
    return NextResponse.json({ kit }, { status: 201 });
  } catch (error) {
    return mapInventoryError(error);
  }
}
