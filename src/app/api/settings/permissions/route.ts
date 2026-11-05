/**
 * GET    /api/settings/permissions  — list all role overrides (owner only)
 * POST   /api/settings/permissions  — set a role override (owner only)
 * DELETE /api/settings/permissions  — remove a role override (owner only)
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePermission, type PermissionResult } from "@/lib/api-auth";
import { mapRouteError } from "@/lib/api/routeErrors";
import {
  listRoleOverrides,
  setRoleOverride,
  deleteRoleOverride,
} from "@/repositories/permissionOverrides";
import { getRepositoryContext } from "@/repositories/supabaseContext";
import { isLockedDeny } from "@/services/authorization";
import type { CoreTable, TableAction, AppRole } from "@/services/authorization";

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

const SetOverrideSchema = z.object({
  role: z.enum(["manager", "dispatch", "tech", "office", "sales", "portal"]),
  tableName: z.string().min(1),
  action: z.enum(["select", "insert", "update", "delete"]),
  allowed: z.boolean(),
});

const DeleteOverrideSchema = z.object({
  role: z.enum(["manager", "dispatch", "tech", "office", "sales", "portal"]),
  tableName: z.string().min(1),
  action: z.enum(["select", "insert", "update", "delete"]),
});

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const guard = await requireOwner(request);
  if (!guard.ok) return guard.response;

  try {
    const ctx = await getRepositoryContext({ userId: guard.ctx.userId });
    const overrides = await listRoleOverrides(ctx.orgId, { userId: guard.ctx.userId });
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

  const parsed = SetOverrideSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { role, tableName, action, allowed } = parsed.data;

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
    const override = await setRoleOverride(
      ctx.orgId,
      role as AppRole,
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

  const parsed = DeleteOverrideSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { role, tableName, action } = parsed.data;

  try {
    const ctx = await getRepositoryContext({ userId: guard.ctx.userId });
    await deleteRoleOverride(
      ctx.orgId,
      role as AppRole,
      tableName as CoreTable,
      action as TableAction,
      { userId: guard.ctx.userId },
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return mapRouteError(error);
  }
}
