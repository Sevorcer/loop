/**
 * Contractors API — backed by the real `contractors` table (F19).
 *
 * GET  /api/contractors — list all contractors for the caller's org.
 * POST /api/contractors — create a contractor in the caller's org.
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { invalidJsonResponse, mapRouteError, readJsonObject } from "@/lib/api/routeErrors";
import { emitAuditEvent } from "@/lib/audit";
import { logWriteFailure } from "@/lib/observability/writes";
import { createContractor, listContractors } from "@/services/contractors";
import type { ContractorTrade } from "@/features/contractors/types/contractor";

const CONTRACTOR_TRADES = new Set<ContractorTrade | "">([
  "",
  "HVAC",
  "Electrical",
  "Plumbing",
  "Roofing",
  "General",
  "Other",
]);

function readTrade(value: unknown): ContractorTrade | "" {
  const normalized = String(value ?? "");
  if (!CONTRACTOR_TRADES.has(normalized as ContractorTrade | "")) {
    throw new Error("Invalid trade.");
  }
  return normalized as ContractorTrade | "";
}

export async function GET(request: Request) {
  const guard = await requirePermission(request, "contractors", "select");
  if (!guard.ok) return guard.response;

  try {
    const contractors = await listContractors();
    return NextResponse.json({ contractors });
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function POST(request: Request) {
  const guard = await requirePermission(request, "contractors", "insert");
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    return invalidJsonResponse();
  }

  try {
    const contractor = await createContractor({
      companyName: String(body.companyName ?? "").trim(),
      contactName: String(body.contactName ?? "").trim(),
      email: String(body.email ?? "").trim(),
      phone: String(body.phone ?? "").trim(),
      trade: readTrade(body.trade),
    });

    emitAuditEvent({
      role: guard.ctx.role,
      action: "create",
      resource: "contractors",
      resourceId: contractor.id,
      details: { companyName: contractor.companyName },
    });

    return NextResponse.json({ contractor }, { status: 201 });
  } catch (error) {
    logWriteFailure({ route: "/api/contractors", request }, error);
    return mapRouteError(error);
  }
}
