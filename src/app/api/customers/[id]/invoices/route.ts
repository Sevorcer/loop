import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { createApiErrorResponse, mapRouteError } from "@/lib/api/routeErrors";
import { getCustomerInvoices } from "@/services/customerInvoices";

/** Read-only invoices for a customer account (invoicing stays in QuickBooks). */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermission(request, "customer_invoices", "select");
  if (!guard.ok) return guard.response;

  try {
    const { id } = await params;
    const result = await getCustomerInvoices(id);
    if (!result) return createApiErrorResponse("NOT_FOUND", "Customer not found.", 404);
    return NextResponse.json(result);
  } catch (error) {
    return mapRouteError(error);
  }
}
