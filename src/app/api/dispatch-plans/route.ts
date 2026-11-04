/**
 * Dispatch snapshot API.
 *
 * GET  /api/dispatch-plans — windowed dispatch snapshot: all active plans
 *                             plus the last N days of completed work,
 *                             matching the board page's own window so the
 *                             client-side refresh never loads unbounded
 *                             history.
 * POST /api/dispatch-plans — create a new dispatch plan.
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import {
  invalidJsonResponse,
  mapRepositoryError,
  mapRouteError,
  readJsonObject,
} from "@/lib/api/routeErrors";
import { logWriteFailure } from "@/lib/observability/writes";
import { loadBoardDispatchSnapshot, createPlan } from "@/services/dispatch";
import type { DispatchPlanWriteInput } from "@/services/dispatch";

export async function GET(request: Request) {
  const guard = await requirePermission(request, "jobs", "select");
  if (!guard.ok) return guard.response;

  try {
    const snapshot = await loadBoardDispatchSnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function POST(request: Request) {
  const guard = await requirePermission(request, "jobs", "insert");
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    return invalidJsonResponse();
  }

  try {
    const input: DispatchPlanWriteInput = {
      jobId: body.jobId as string | undefined,
      jobNumber: String(body.jobNumber ?? ""),
      customerName: String(body.customerName ?? ""),
      propertyName: String(body.propertyName ?? ""),
      jobType: String(body.jobType ?? ""),
      dispatchStatus: (body.dispatchStatus as DispatchPlanWriteInput["dispatchStatus"]) ?? "ready_to_schedule",
      dispatchability: (body.dispatchability as DispatchPlanWriteInput["dispatchability"]) ?? {
        isDispatchable: false,
        materialReadiness: { state: "not_satisfied", reason: "" },
        technicalReadiness: { state: "not_satisfied", reason: "" },
        customerReadiness: { state: "not_satisfied", reason: "" },
        crewReadiness: { state: "not_satisfied", reason: "" },
      },
      targetDate: body.targetDate as string | undefined,
      estimatedDurationHours: Number(body.estimatedDurationHours ?? 0),
      priority: (body.priority as DispatchPlanWriteInput["priority"]) ?? "normal",
      sequencingNotes: body.sequencingNotes as string | undefined,
      constraints: (body.constraints as DispatchPlanWriteInput["constraints"]) ?? [],
    };

    const result = await createPlan(input);
    if (!result.ok) {
      return mapRepositoryError(result.error);
    }
    return NextResponse.json({ plan: result.data }, { status: 201 });
  } catch (error) {
    logWriteFailure({ route: "/api/dispatch-plans", request }, error);
    return mapRouteError(error);
  }
}
