import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapRouteError, readJsonObject } from "@/lib/api/routeErrors";
import { updateGcChangeOrder, deleteGcChangeOrder } from "@/services/gcLedger";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; entryId: string; orderId: string }> },
) {
  const guard = await requirePermission(request, "gc_change_orders", "update");
  if (!guard.ok) return guard.response;

  try {
    const { orderId } = await params;
    const body = await readJsonObject(request);
    const changeOrder = await updateGcChangeOrder(orderId, {
      changeOrderNumber: body.changeOrderNumber as string | undefined,
      amountCents: body.amountCents as number | undefined,
      description: body.description as string | undefined,
    });

    if (!changeOrder) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Change order not found.", code: 404 },
        { status: 404 },
      );
    }

    return NextResponse.json({ changeOrder });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; entryId: string; orderId: string }> },
) {
  const guard = await requirePermission(request, "gc_change_orders", "delete");
  if (!guard.ok) return guard.response;

  try {
    const { orderId } = await params;
    await deleteGcChangeOrder(orderId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return mapRouteError(error);
  }
}
