import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapRouteError } from "@/lib/api/routeErrors";
import { listInventoryItems } from "@/repositories/inventory";

export async function GET(request: Request) {
  const guard = await requirePermission(request, "jobs", "select");
  if (!guard.ok) return guard.response;

  try {
    const inventory = await listInventoryItems();
    return NextResponse.json(inventory);
  } catch (error) {
    return mapRouteError(error);
  }
}
