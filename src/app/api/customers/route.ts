import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { invalidJsonResponse, mapRouteError, readJsonObject } from "@/lib/api/routeErrors";
import { emitAuditEvent } from "@/lib/audit";
import { createCustomer, listCustomers } from "@/services/customers";

export async function GET(request: Request) {
  const guard = requirePermission(request, "customers", "select");
  if (!guard.ok) return guard.response;

  try {
    return NextResponse.json({ customers: await listCustomers() });
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
      name: String(body.name ?? ""),
      primaryContact: String(body.primaryContact ?? ""),
      email: String(body.email ?? ""),
      phone: String(body.phone ?? ""),
      city: String(body.city ?? ""),
      status: String(body.status ?? "Active") as "Active" | "Prospect" | "Inactive",
    });

    emitAuditEvent({
      role: guard.ctx.role,
      action: "create",
      resource: "customers",
      resourceId: customer.id,
      details: { name: customer.name },
    });

    return NextResponse.json({ message: "Customer created.", customer }, { status: 201 });
  } catch (error) {
    return mapRouteError(error);
  }
}
