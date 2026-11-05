import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import {
  createApiErrorResponse,
  invalidJsonResponse,
  mapRouteError,
  readJsonObject,
} from "@/lib/api/routeErrors";
import {
  approveChangeOrder,
  canDeleteChangeOrders,
  canEditChangeOrders,
  createChangeOrder,
  declineChangeOrder,
  deleteChangeOrder,
  listByJobId,
  updateChangeOrder,
} from "@/services/jobChangeOrders";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "job_change_orders", "select");
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    const changeOrders = await listByJobId(id);
    return NextResponse.json({ changeOrders });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "job_change_orders", "insert");
  if (!guard.ok) return guard.response;
  if (!canEditChangeOrders(guard.ctx.role)) {
    return createApiErrorResponse(
      "FORBIDDEN",
      "Only office staff and above can create change orders.",
      403,
    );
  }

  try {
    const { id } = await params;
    const body = await readJsonObject(request);

    const amountCents =
      typeof body.amountCents === "number" ? body.amountCents : 0;

    const changeOrder = await createChangeOrder({
      jobId: id,
      title: String(body.title ?? ""),
      description: typeof body.description === "string" ? body.description : "",
      amountCents,
      createdBy: guard.ctx.userId,
    });

    return NextResponse.json({ changeOrder }, { status: 201 });
  } catch (error) {
    if (
      error instanceof SyntaxError ||
      (error instanceof Error && error.message === "Invalid JSON body.")
    ) {
      return invalidJsonResponse();
    }
    return mapRouteError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "job_change_orders", "update");
  if (!guard.ok) return guard.response;
  if (!canEditChangeOrders(guard.ctx.role)) {
    return createApiErrorResponse(
      "FORBIDDEN",
      "Only office staff and above can update change orders.",
      403,
    );
  }

  try {
    void (await params);
    const body = await readJsonObject(request);
    const changeOrderId = String(body.changeOrderId ?? "").trim();

    if (!changeOrderId) {
      return NextResponse.json(
        { error: "changeOrderId is required." },
        { status: 400 },
      );
    }

    // Approve / decline actions
    if (body.action === "approve") {
      const changeOrder = await approveChangeOrder(changeOrderId);
      return NextResponse.json({ changeOrder });
    }

    if (body.action === "decline") {
      const changeOrder = await declineChangeOrder(changeOrderId);
      return NextResponse.json({ changeOrder });
    }

    // Standard field update
    const changeOrder = await updateChangeOrder(changeOrderId, {
      title: typeof body.title === "string" ? body.title : undefined,
      description: typeof body.description === "string"
        ? body.description
        : undefined,
      amountCents: typeof body.amountCents === "number"
        ? body.amountCents
        : undefined,
    });

    return NextResponse.json({ changeOrder });
  } catch (error) {
    if (
      error instanceof SyntaxError ||
      (error instanceof Error && error.message === "Invalid JSON body.")
    ) {
      return invalidJsonResponse();
    }
    return mapRouteError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "job_change_orders", "delete");
  if (!guard.ok) return guard.response;
  if (!canDeleteChangeOrders(guard.ctx.role)) {
    return createApiErrorResponse(
      "FORBIDDEN",
      "Only owners and managers can delete change orders.",
      403,
    );
  }

  try {
    void (await params);
    const body = await readJsonObject(request);
    const changeOrderId = String(body.changeOrderId ?? "").trim();

    if (!changeOrderId) {
      return NextResponse.json(
        { error: "changeOrderId is required." },
        { status: 400 },
      );
    }

    await deleteChangeOrder(changeOrderId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (
      error instanceof SyntaxError ||
      (error instanceof Error && error.message === "Invalid JSON body.")
    ) {
      return invalidJsonResponse();
    }
    return mapRouteError(error);
  }
}
