import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapRouteError } from "@/lib/api/routeErrors";
import { listPropertiesForCustomer } from "@/services/properties";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = requirePermission(request, "properties", "select");
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    const properties = await listPropertiesForCustomer(id);
    return NextResponse.json({ properties });
  } catch (error) {
    return mapRouteError(error);
  }
}
