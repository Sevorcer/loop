import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapRouteError, readJsonObject } from "@/lib/api/routeErrors";
import { parseDollarsToCents } from "@/lib/money";
import { updateJobBid, deleteJobBid } from "@/services/jobBids";

interface RouteContext {
  params: Promise<{ id: string; bidId: string }>;
}

export async function PUT(request: Request, context: RouteContext) {
  const guard = await requirePermission(request, "job_bids", "update");
  if (!guard.ok) return guard.response;

  try {
    const { bidId } = await context.params;
    const body = await readJsonObject(request);

    const updates: { amountCents?: number; status?: string; fileId?: string | null; notes?: string } = {};

    if (body.amount !== undefined) {
      const parsed = parseDollarsToCents(String(body.amount));
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
      updates.amountCents = parsed.cents;
    }

    if (body.status !== undefined) updates.status = String(body.status);
    if (body.fileId !== undefined) updates.fileId = body.fileId != null ? String(body.fileId) : null;
    if (body.notes !== undefined) updates.notes = String(body.notes);

    const bid = await updateJobBid(bidId, updates);
    if (!bid) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Bid not found.", code: 404 },
        { status: 404 },
      );
    }

    return NextResponse.json({ bid });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const guard = await requirePermission(request, "job_bids", "delete");
  if (!guard.ok) return guard.response;

  try {
    const { bidId } = await context.params;
    const deleted = await deleteJobBid(bidId);
    if (!deleted) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Bid not found.", code: 404 },
        { status: 404 },
      );
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    return mapRouteError(error);
  }
}
