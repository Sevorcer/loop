/**
 * GET  /api/settings/users  — list org users (owner/manager only)
 * POST /api/settings/users  — invite a new user to the org (owner/manager only)
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapRouteError } from "@/lib/api/routeErrors";
import { listOrgUsers, inviteOrgUser } from "@/services/settingsUsers";
import type { InviteUserPayload } from "@/features/settings/types";
import type { AppRole } from "@/services/authorization";

export async function GET(request: Request) {
  const guard = await requirePermission(request, "user_profiles", "select");
  if (!guard.ok) return guard.response;

  try {
    const users = await listOrgUsers(guard.ctx.userId);
    return NextResponse.json({ users });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function POST(request: Request) {
  const guard = await requirePermission(request, "user_profiles", "insert");
  if (!guard.ok) return guard.response;

  try {
    const body = (await request.json()) as Partial<InviteUserPayload>;

    const email = typeof body.email === "string" ? body.email.trim() : "";
    const fullName =
      typeof body.fullName === "string" ? body.fullName.trim() : "";
    const role = body.role as AppRole | undefined;

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "A valid email address is required." },
        { status: 400 }
      );
    }

    if (!role) {
      return NextResponse.json(
        { error: "A role must be selected." },
        { status: 400 }
      );
    }

    const user = await inviteOrgUser(guard.ctx.userId, { email, fullName, role });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    return mapRouteError(error);
  }
}
