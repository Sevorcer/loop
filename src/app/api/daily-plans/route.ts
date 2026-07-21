/**
 * Daily Plans state API.
 *
 * GET  /api/daily-plans — load all notes, activations, and job overrides for
 *                          the caller's org.
 * POST /api/daily-plans — mutate a single daily-plan record (note, activation,
 *                          job override, or packets-sent flag).
 *
 * Authorization: any role with jobs/select access may read daily plan state.
 * Writes are restricted to owner/manager/dispatch/office by RLS.
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import {
  createApiErrorResponse,
  invalidJsonResponse,
  mapRepositoryError,
  mapRouteError,
  readJsonObject,
} from "@/lib/api/routeErrors";
import {
  activatePlan,
  getDailyPlansState,
  markPacketsSent,
  saveNote,
  setJobOverride,
} from "@/services/dailyPlans";

export async function GET(request: Request) {
  const guard = await requirePermission(request, "jobs", "select");
  if (!guard.ok) return guard.response;

  try {
    const state = await getDailyPlansState();
    return NextResponse.json(state);
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function POST(request: Request) {
  const guard = await requirePermission(request, "jobs", "select");
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    return invalidJsonResponse();
  }

  const action = String(body.action ?? "");

  try {
    switch (action) {
      case "save_note": {
        const date = String(body.date ?? "");
        const content = String(body.content ?? "");
        if (!date) {
          return createApiErrorResponse("INVALID_INPUT", "date is required.", 400);
        }
        const result = await saveNote(date, content);
        if (!result.ok) {
          return mapRepositoryError(result.error);
        }
        return NextResponse.json({ note: result.data });
      }

      case "activate_plan": {
        const date = String(body.date ?? "");
        if (!date) {
          return createApiErrorResponse("INVALID_INPUT", "date is required.", 400);
        }
        const result = await activatePlan(date);
        if (!result.ok) {
          return mapRepositoryError(result.error);
        }
        return NextResponse.json({ activation: result.data });
      }

      case "set_job_override": {
        const jobId = String(body.jobId ?? "");
        const readinessState = body.readinessState as "ready" | "needs-attention" | undefined;
        if (!jobId) {
          return createApiErrorResponse("INVALID_INPUT", "jobId is required.", 400);
        }
        const result = await setJobOverride(jobId, readinessState ?? undefined);
        if (!result.ok) {
          return mapRepositoryError(result.error);
        }
        return NextResponse.json({ override: result.data });
      }

      case "mark_packets_sent": {
        const date = String(body.date ?? "");
        if (!date) {
          return createApiErrorResponse("INVALID_INPUT", "date is required.", 400);
        }
        const result = await markPacketsSent(date);
        if (!result.ok) {
          return mapRepositoryError(result.error);
        }
        return NextResponse.json({ activation: result.data });
      }

      default:
        return createApiErrorResponse("INVALID_INPUT", `Unknown action: ${action}`, 400);
    }
  } catch (error) {
    return mapRouteError(error);
  }
}
