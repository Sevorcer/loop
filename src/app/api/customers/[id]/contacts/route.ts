import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { invalidJsonResponse, mapRouteError, readJsonObject } from "@/lib/api/routeErrors";
import { emitAuditEvent } from "@/lib/audit";
import { logWriteFailure } from "@/lib/observability/writes";
import {
  listCustomerContacts,
  createCustomerContact,
} from "@/services/customerContacts";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "customer_contacts", "select");
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    const contacts = await listCustomerContacts(id);
    return NextResponse.json({ contacts });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "customer_contacts", "insert");
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    return invalidJsonResponse();
  }

  try {
    const { id } = await params;
    const contact = await createCustomerContact(id, {
      name: String(body.name ?? "").trim(),
      role: String(body.role ?? "other"),
      phone: String(body.phone ?? "").trim(),
      email: String(body.email ?? "").trim(),
    });

    emitAuditEvent({
      role: guard.ctx.role,
      action: "create",
      resource: "customers",
      resourceId: id,
      details: { contactId: contact.id, name: contact.name },
    });

    return NextResponse.json({ contact }, { status: 201 });
  } catch (error) {
    logWriteFailure({ route: "/api/customers/[id]/contacts", request }, error);
    return mapRouteError(error);
  }
}
