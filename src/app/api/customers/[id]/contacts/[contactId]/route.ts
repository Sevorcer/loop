import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { invalidJsonResponse, mapRouteError, readJsonObject } from "@/lib/api/routeErrors";
import { emitAuditEvent } from "@/lib/audit";
import { logWriteFailure } from "@/lib/observability/writes";
import {
  updateCustomerContact,
  deleteCustomerContact,
} from "@/services/customerContacts";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; contactId: string }> },
) {
  const guard = await requirePermission(request, "customer_contacts", "update");
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    return invalidJsonResponse();
  }

  try {
    const { id, contactId } = await params;
    const contact = await updateCustomerContact(contactId, {
      name: body.name !== undefined ? String(body.name).trim() : undefined,
      role: body.role !== undefined ? String(body.role) : undefined,
      phone: body.phone !== undefined ? String(body.phone).trim() : undefined,
      email: body.email !== undefined ? String(body.email).trim() : undefined,
    });

    if (!contact) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: `Contact '${contactId}' not found.`, code: 404 },
        { status: 404 },
      );
    }

    emitAuditEvent({
      role: guard.ctx.role,
      action: "update",
      resource: "customers",
      resourceId: id,
      details: { contactId, ...body },
    });

    return NextResponse.json({ contact });
  } catch (error) {
    logWriteFailure({ route: "/api/customers/[id]/contacts/[contactId]", request }, error);
    return mapRouteError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; contactId: string }> },
) {
  const guard = await requirePermission(request, "customer_contacts", "delete");
  if (!guard.ok) return guard.response;

  try {
    const { id, contactId } = await params;
    const deleted = await deleteCustomerContact(contactId);

    if (!deleted) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: `Contact '${contactId}' not found.`, code: 404 },
        { status: 404 },
      );
    }

    emitAuditEvent({
      role: guard.ctx.role,
      action: "delete",
      resource: "customers",
      resourceId: id,
      details: { contactId },
    });

    return NextResponse.json({ message: "Contact deleted.", id: contactId });
  } catch (error) {
    logWriteFailure({ route: "/api/customers/[id]/contacts/[contactId]", request }, error);
    return mapRouteError(error);
  }
}
