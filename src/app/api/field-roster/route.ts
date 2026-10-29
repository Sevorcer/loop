import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapRouteError } from "@/lib/api/routeErrors";
import { loadFieldRoster } from "@/repositories/fieldRoster";

export async function GET(request: Request) {
  const guard = await requirePermission(request, "jobs", "select");
  if (!guard.ok) return guard.response;

  try {
    const roster = await loadFieldRoster();
    return NextResponse.json(roster);
  } catch (error) {
    return mapRouteError(error);
  }
}
