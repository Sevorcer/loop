import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { invalidJsonResponse, mapRouteError, readJsonObject } from "@/lib/api/routeErrors";
import { emitAuditEvent } from "@/lib/audit";
import { createCustomer, listCustomers } from "@/services/customers";

export async function GET(request: Request) {
  const guard = requirePermission(request, "customers", "select");
  if (!guard.ok) return guard.response;

  try {
    const customers = await listCustomers();
    return NextResponse.json({ customers });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function POST(request: Request) {
  const guard = requirePermission(request, "customers", "insert");
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    return invalidJsonResponse();
  }

  try {
    const customer = await createCustomer({
      name: String(body.name ?? "").trim(),
      primaryContact: String(body.primaryContact ?? "").trim(),
      email: String(body.email ?? "").trim(),
      phone: String(body.phone ?? "").trim(),
      city: String(body.city ?? "").trim(),
      status: (body.status as "Active" | "Prospect" | "Inactive") ?? "Active",
    });

    emitAuditEvent({
      role: guard.ctx.role,
      action: "create",
      resource: "customers",
      resourceId: customer.id,
      details: { name: customer.name },
    });

    return NextResponse.json({ customer }, { status: 201 });
  } catch (error) {
    return mapRouteError(error);
  }
}
