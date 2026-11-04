import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapRouteError, readJsonObject } from "@/lib/api/routeErrors";
import { parseDollarsToCents } from "@/lib/money";
import { listJobBids, createJobBid } from "@/services/jobBids";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const guard = await requirePermission(request, "job_bids", "select");
  if (!guard.ok) return guard.response;

  try {
    const { id } = await context.params;
    const bids = await listJobBids(id);
    return NextResponse.json({ bids });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const guard = await requirePermission(request, "job_bids", "insert");
  if (!guard.ok) return guard.response;

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
    if (parsed.cents == null || parsed.cents <= 0) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: "Bid amount must be greater than zero.", code: 400 },
        { status: 400 },
      );
    }

    const status = String(body.status ?? "draft");
    const fileId = body.fileId != null ? String(body.fileId) : null;
    const notes = body.notes != null ? String(body.notes) : "";

    const bid = await createJobBid({
      jobId: id,
      amountCents: parsed.cents,
      status,
      fileId,
      notes,
      createdBy: guard.ctx.userId || null,
    });

    return NextResponse.json({ bid }, { status: 201 });
  } catch (error) {
    return mapRouteError(error);
  }
}
