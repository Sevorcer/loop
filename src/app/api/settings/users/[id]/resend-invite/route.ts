/**
 * POST /api/settings/users/[id]/resend-invite
 *
 * Sends a fresh account-setup email for someone who has not signed in yet.
 * Owner or manager, and only for a person in the caller's company.
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapRouteError } from "@/lib/api/routeErrors";
import { resendOrgInvite } from "@/services/settingsUsers";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: Params) {
  const guard = await requirePermission(request, "user_profiles", "update");
  if (!guard.ok) return guard.response;

  const { id } = await params;

  try {
    await resendOrgInvite(guard.ctx.userId, id, {
      origin: new URL(request.url).origin,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return mapRouteError(error);
  }
}
