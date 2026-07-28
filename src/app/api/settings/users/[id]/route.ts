/**
 * PATCH /api/settings/users/[id]  — update user profile (owner/manager only)
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapRouteError } from "@/lib/api/routeErrors";
import { updateOrgUser, setOrgUserStatus } from "@/services/settingsUsers";
import type { UpdateUserPayload } from "@/features/settings/types";
import type { AppRole } from "@/services/authorization";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: Params) {
  const guard = await requirePermission(request, "user_profiles", "update");
  if (!guard.ok) return guard.response;

  const { id } = await params;

  try {
    const body = (await request.json()) as Partial<
      UpdateUserPayload & { status: "active" | "inactive" }
    >;

    // Status change
    if (body.status === "active" || body.status === "inactive") {
      await setOrgUserStatus(id, body.status);
    }

    // Profile updates
    const profileUpdate: UpdateUserPayload = {};
    if (typeof body.fullName === "string")
      profileUpdate.fullName = body.fullName.trim();
    if (typeof body.role === "string")
      profileUpdate.role = body.role as AppRole;

    if (profileUpdate.fullName !== undefined || profileUpdate.role !== undefined) {
      await updateOrgUser(id, profileUpdate);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return mapRouteError(error);
  }
}
