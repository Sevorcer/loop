import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { invalidJsonResponse, mapRouteError, readJsonObject } from "@/lib/api/routeErrors";
import { emitAuditEvent } from "@/lib/audit";
import { logWriteFailure } from "@/lib/observability/writes";
import { createCustomer, listCustomers } from "@/services/customers";

const CUSTOMER_STATUSES = new Set(["Active", "Prospect", "Inactive"]);

function readCustomerStatus(value: unknown) {
  const normalized = String(value ?? "Active");
  if (!CUSTOMER_STATUSES.has(normalized)) {
    throw new Error("Invalid customer status.");
  }
  return normalized as "Active" | "Prospect" | "Inactive";
}

export async function GET(request: Request) {
  const guard = await requirePermission(request, "customers", "select");
  if (!guard.ok) return guard.response;

  try {
    const search = new URL(request.url).searchParams.get("search") ?? undefined;
    const customers = await listCustomers({ search });
    return NextResponse.json({ customers });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function POST(request: Request) {
  const guard = await requirePermission(request, "customers", "insert");
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
      phone2: String(body.phone2 ?? "").trim(),
      city: String(body.city ?? "").trim(),
      street: String(body.street ?? "").trim(),
      zip: String(body.zip ?? "").trim(),
      notes: String(body.notes ?? "").trim(),
      status: readCustomerStatus(body.status),
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
    logWriteFailure({ route: "/api/customers", request }, error);
    return mapRouteError(error);
  }
}
