/**
 * Portal Projects API — Sprint 27 #58/#59
 *
 * GET /api/portal-projects              — list all portal projects for the org
 * GET /api/portal-projects?projectId=xx — load full project bundle
 *
 * Access: all internal staff + portal role
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapRouteError } from "@/lib/api/routeErrors";
import {
  getPortalProjectBundle,
  getPortalProjects,
} from "@/services/portalProjects";

export async function GET(request: Request) {
  const guard = await requirePermission(request, "portal_projects", "select");
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");

  try {
    if (projectId) {
      const bundle = await getPortalProjectBundle(projectId);
      return NextResponse.json(bundle);
    }

    const projects = await getPortalProjects();
    return NextResponse.json({ projects });
  } catch (error) {
    return mapRouteError(error);
  }
}
