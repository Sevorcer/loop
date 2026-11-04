import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { mapRouteError, readJsonObject } from "@/lib/api/routeErrors";
import { getGcChangeOrders, createGcChangeOrder } from "@/services/gcLedger";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; entryId: string }> },
) {
  const guard = await requirePermission(request, "gc_change_orders", "select");
  if (!guard.ok) return guard.response;

  try {
    const { entryId } = await params;
    const changeOrders = await getGcChangeOrders(entryId);
    return NextResponse.json({ changeOrders });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; entryId: string }> },
) {
  const guard = await requirePermission(request, "gc_change_orders", "insert");
  if (!guard.ok) return guard.response;

  try {
    const { entryId } = await params;
    const body = await readJsonObject(request);
    const changeOrder = await createGcChangeOrder(entryId, {
      changeOrderNumber: body.changeOrderNumber as string | undefined,
      amountCents: body.amountCents as number | undefined,
      description: body.description as string | undefined,
    });
    return NextResponse.json({ changeOrder }, { status: 201 });
  } catch (error) {
    return mapRouteError(error);
  }
}
