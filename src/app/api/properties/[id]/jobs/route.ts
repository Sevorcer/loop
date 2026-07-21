import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapRouteError } from "@/lib/api/routeErrors";
import { listJobsForProperty } from "@/services/jobs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = requirePermission(request, "jobs", "select");
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    const jobs = await listJobsForProperty(id);
    return NextResponse.json({ jobs });
  } catch (error) {
    return mapRouteError(error);
  }
}
