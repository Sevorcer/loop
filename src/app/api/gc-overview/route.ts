import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapRouteError } from "@/lib/api/routeErrors";
import { getGcBuildersOverview } from "@/services/gcLedger";

export async function GET(request: Request) {
  const guard = await requirePermission(request, "gc_ledger_entries", "select");
  if (!guard.ok) return guard.response;

  try {
    const builders = await getGcBuildersOverview();
    return NextResponse.json({ builders });
  } catch (error) {
    return mapRouteError(error);
  }
}
