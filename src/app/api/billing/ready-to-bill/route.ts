import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { createForbiddenResponse } from "@/lib/auth/errorContract";
import { mapRouteError } from "@/lib/api/routeErrors";
import { getReadyToBillJobs } from "@/services/billing";

const VALID_TYPES = new Set(["install", "service"]);
const BILLING_ROLES = new Set(["owner", "manager", "office"]);

export async function GET(request: Request) {
  // Billing lists are visible to office and above (same as jobs select).
  const guard = await requirePermission(request, "jobs", "select");
  if (!guard.ok) return guard.response;

  // Explicit role check — jobs permission is too broad for billing.
  if (!BILLING_ROLES.has(guard.ctx.role)) {
    return createForbiddenResponse("Billing access requires owner, manager, or office role.");
  }

  try {
    const url = new URL(request.url);
    const typeParam = (url.searchParams.get("type") ?? "").toLowerCase();

    if (!VALID_TYPES.has(typeParam)) {
      return NextResponse.json(
        { error: "Query parameter 'type' must be 'install' or 'service'." },
        { status: 400 },
      );
    }

    const jobType = typeParam === "install" ? "Install" : "Service";
    const jobs = await getReadyToBillJobs(jobType as "Install" | "Service");

    return NextResponse.json({ jobs });
  } catch (error) {
    return mapRouteError(error);
  }
}
