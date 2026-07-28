/**
 * POST /api/settings/users/[id]/reset-password
 *
 * Triggers a password reset email for the specified user.
 * Restricted to owner/manager roles.
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapRouteError } from "@/lib/api/routeErrors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: Params) {
  const guard = await requirePermission(request, "user_profiles", "update");
  if (!guard.ok) return guard.response;

  const { id } = await params;

  try {
    // Resolve the user's email from auth
    const admin = createSupabaseAdminClient();
    const { data: userData, error: userError } =
      await admin.auth.admin.getUserById(id);

    if (userError || !userData?.user?.email) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    // Verify the target user belongs to the same org as the caller
    const supabase = await createSupabaseServerClient();
    const { data: callerProfile } = await supabase
      .from("user_profiles")
      .select("org_id")
      .eq("id", guard.ctx.userId)
      .single();

    const { data: targetProfile } = await supabase
      .from("user_profiles")
      .select("org_id")
      .eq("id", id)
      .single();

    if (!callerProfile || !targetProfile) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
    }

    if (callerProfile.org_id !== targetProfile.org_id) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
    }

    // Generate a recovery link (Supabase sends the email automatically)
    const { error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: userData.user.email,
    });

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return mapRouteError(error);
  }
}
