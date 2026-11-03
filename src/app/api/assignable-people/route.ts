/**
 * GET /api/assignable-people — active org members who can be assigned to a job.
 *
 * Sourced from the same profiles + auth-ban merge as Settings > Users, so
 * deactivated / auth-banned accounts and the external portal role are
 * excluded, and the owner is included. Gated on jobs:select so anyone who can
 * view jobs (and therefore open the New/Edit Job form) can load the picker.
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapRouteError } from "@/lib/api/routeErrors";
import { listAssignableMembers } from "@/services/assignableMembers";

export async function GET(request: Request) {
  const guard = await requirePermission(request, "jobs", "select");
  if (!guard.ok) return guard.response;

  try {
    const people = await listAssignableMembers(guard.ctx.userId);
    return NextResponse.json({ people });
  } catch (error) {
    return mapRouteError(error);
  }
}
