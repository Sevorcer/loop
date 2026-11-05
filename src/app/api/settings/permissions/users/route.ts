/**
 * GET    /api/settings/permissions/users  — list user overrides (owner only)
 * POST   /api/settings/permissions/users  — set a user override (owner only)
 * DELETE /api/settings/permissions/users  — remove a user override (owner only)
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission, type PermissionResult } from "@/lib/api-auth";
import { mapRouteError } from "@/lib/api/routeErrors";
import {
  listUserOverrides,
  setUserOverride,
  deleteUserOverride,
} from "@/repositories/permissionOverrides";
import { getRepositoryContext } from "@/repositories/supabaseContext";
import { isLockedDeny } from "@/services/authorization";
import type { CoreTable, TableAction } from "@/services/authorization";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function requireOwner(request: Request): Promise<PermissionResult> {
  const guard = await requirePermission(request, "user_profiles", "select");
  if (!guard.ok) return guard;
  if (guard.ctx.role !== "owner") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "FORBIDDEN", message: "Only owners can manage permission overrides." },
        { status: 403 },
      ),
    };
  }
  return guard;
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const SetUserOverrideSchema = z.object({
  userId: z.string().uuid(),
  tableName: z.string().min(1),
  action: z.enum(["select", "insert", "update", "delete"]),
  allowed: z.boolean(),
});

const DeleteUserOverrideSchema = z.object({
  userId: z.string().uuid(),
  tableName: z.string().min(1),
  action: z.enum(["select", "insert", "update", "delete"]),
});

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const guard = await requireOwner(request);
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const queryUserId = url.searchParams.get("userId") ?? undefined;

  try {
    const ctx = await getRepositoryContext({ userId: guard.ctx.userId });
    const overrides = await listUserOverrides(ctx.orgId, queryUserId, {
      userId: guard.ctx.userId,
    });
    return NextResponse.json({ overrides });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function POST(request: Request) {
  const guard = await requireOwner(request);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "INVALID_JSON", message: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const parsed = SetUserOverrideSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { userId, tableName, action, allowed } = parsed.data;

  // Enforce invariants: cannot grant on locked-deny actions
  if (allowed && isLockedDeny(tableName as CoreTable, action as TableAction)) {
    return NextResponse.json(
      {
        error: "INVARIANT_VIOLATION",
        message: `Cannot grant '${action}' on '${tableName}' — this action is locked by a system invariant.`,
      },
      { status: 422 },
    );
  }

  try {
    const ctx = await getRepositoryContext({ userId: guard.ctx.userId });
    const override = await setUserOverride(
      ctx.orgId,
      userId,
      tableName as CoreTable,
      action as TableAction,
      allowed,
      { userId: guard.ctx.userId },
    );
    return NextResponse.json({ override }, { status: 200 });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function DELETE(request: Request) {
  const guard = await requireOwner(request);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "INVALID_JSON", message: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const parsed = DeleteUserOverrideSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { userId, tableName, action } = parsed.data;

  try {
    const ctx = await getRepositoryContext({ userId: guard.ctx.userId });
    await deleteUserOverride(
      ctx.orgId,
      userId,
      tableName as CoreTable,
      action as TableAction,
      { userId: guard.ctx.userId },
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return mapRouteError(error);
  }
}
