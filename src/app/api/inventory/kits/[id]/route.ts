/**
 * GET   /api/inventory/kits/[id] — one kit with its lines
 * PATCH /api/inventory/kits/[id] — change header fields (name, description, category,
 *       status) and/or replace the lines. Only the keys sent change. The kit version
 *       bumps only when line content changes.
 *
 * Roles: kit_templates select (every internal role) / update (owner, manager, office).
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapInventoryError, validationError } from "@/lib/api/inventoryRoute";
import { invalidJsonResponse, readJsonObject } from "@/lib/api/routeErrors";
import { getKit, updateKit } from "@/services/kitTemplates";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(request, "kit_templates", "select");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  try {
    return NextResponse.json({ kit: await getKit(id) });
  } catch (error) {
    return mapInventoryError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermission(request, "kit_templates", "update");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    return invalidJsonResponse();
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return validationError("Send a JSON object.");

  const { lines, ...headerKeys } = body;
  const header: Record<string, unknown> = {};
  for (const key of ["name", "description", "category", "status"]) {
    if (key in headerKeys) header[key] = headerKeys[key];
  }

  try {
    const kit = await updateKit(id, { header, lines });
    return NextResponse.json({ kit });
  } catch (error) {
    return mapInventoryError(error);
  }
}
