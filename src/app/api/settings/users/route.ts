/**
 * GET  /api/settings/users  — list org users (owner/manager only)
 * POST /api/settings/users  — invite a new user to the org (owner/manager only)
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/api-auth";
import { mapRouteError } from "@/lib/api/routeErrors";
import { extractSupabaseError } from "@/lib/api/postFailureTelemetry";
import { buildValidationError } from "@/lib/adminApiError";
import { logWriteFailure } from "@/lib/observability/writes";
import { listOrgUsers, inviteOrgUser } from "@/services/settingsUsers";
import type { InviteUserPayload } from "@/features/settings/types";

const InviteUserRequestSchema = z.object({
  email: z.email("A valid email address is required.").trim(),
  fullName: z.string().trim().max(255, "Full name must be 255 characters or fewer.").optional().default(""),
  appRole: z.enum(["owner", "manager", "dispatch", "tech", "office", "sales", "portal"], {
    message: "A valid appRole is required.",
  }),
});

function createInviteUserErrorResponse(error: unknown) {
  const supabaseError = extractSupabaseError(error);
  const status =
    supabaseError.status && supabaseError.status >= 400 && supabaseError.status < 600
      ? supabaseError.status
      : 500;

  return NextResponse.json(
    {
      error: "USER_CREATE_FAILED",
      message: supabaseError.message ?? "Failed to create the user account.",
      code: supabaseError.code ?? "USER_CREATE_FAILED",
      details: supabaseError.details,
    },
    { status },
  );
}

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

  let body: Partial<InviteUserPayload>;
  try {
    body = (await request.json()) as Partial<InviteUserPayload>;
  } catch {
    return NextResponse.json(
      buildValidationError({ _root: ["Request body must be valid JSON."] }),
      { status: 400 },
    );
  }

  const parsed = InviteUserRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(buildValidationError(parsed.error.flatten().fieldErrors), {
      status: 400,
    });
  }

  try {
    const user = await inviteOrgUser(guard.ctx.userId, parsed.data);
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    logWriteFailure({ route: "/api/settings/users", operation: "create_user", request }, error);
    return createInviteUserErrorResponse(error);
  }
}
