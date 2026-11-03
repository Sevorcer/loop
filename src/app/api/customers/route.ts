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

/** Optional list query params: invalid values are ignored, not errors. */
function readListPageParam(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : undefined;
}

function readOptionalCustomerStatus(value: string | null) {
  if (!value || !CUSTOMER_STATUSES.has(value)) return undefined;
  return value as "Active" | "Prospect" | "Inactive";
}

export async function GET(request: Request) {
  const guard = await requirePermission(request, "customers", "select");
  if (!guard.ok) return guard.response;

  try {
    const params = new URL(request.url).searchParams;
    const result = await listCustomers({
      search: params.get("search") ?? undefined,
      page: readListPageParam(params.get("page")),
      pageSize: readListPageParam(params.get("pageSize")),
      status: readOptionalCustomerStatus(params.get("status")),
      city: params.get("city") ?? undefined,
    });
    return NextResponse.json({
      customers: result.items,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    });
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
