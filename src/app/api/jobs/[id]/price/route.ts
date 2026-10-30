import { NextResponse } from "next/server";

import { parseDollarsToCents } from "@/lib/money";
import { requirePermission } from "@/lib/api-auth";
import { mapRouteError, readJsonObject } from "@/lib/api/routeErrors";
import { canSeeJobRevenue } from "@/features/reporting/utils/revenueAccess";
import { getJobPriceForRole, setJobPriceForRole } from "@/services/jobPrice";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function hidden() {
  return NextResponse.json(
    { error: "FORBIDDEN", message: "You cannot view or change job prices.", code: 403 },
    { status: 403 },
  );
}

export async function GET(request: Request, context: RouteContext) {
  const guard = await requirePermission(request, "job_financials", "select");
  if (!guard.ok) return guard.response;
  if (!canSeeJobRevenue(guard.ctx.role)) return hidden();

  try {
    const { id } = await context.params;
    const revenueCents = await getJobPriceForRole(guard.ctx.role, id);
    return NextResponse.json({ revenueCents });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const guard = await requirePermission(request, "job_financials", "update");
  if (!guard.ok) return guard.response;
  if (!canSeeJobRevenue(guard.ctx.role)) return hidden();

  try {
    const { id } = await context.params;
    const body = await readJsonObject(request);
    const parsed = parseDollarsToCents(String(body.amount ?? ""));
    if (!parsed.ok) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: parsed.message, code: 400 },
        { status: 400 },
      );
    }
    const revenueCents = await setJobPriceForRole(guard.ctx.role, id, parsed.cents, guard.ctx.userId || null);
    return NextResponse.json({ revenueCents });
  } catch (error) {
    return mapRouteError(error);
  }
}
