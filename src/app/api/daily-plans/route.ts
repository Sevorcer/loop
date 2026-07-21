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
import { invalidJsonResponse, mapRouteError, readJsonObject } from "@/lib/api/routeErrors";
import {
  activatePlan,
  getDailyPlansState,
  markPacketsSent,
  saveNote,
  setJobOverride,
} from "@/services/dailyPlans";

export async function GET(request: Request) {
  const guard = requirePermission(request, "jobs", "select");
  if (!guard.ok) return guard.response;

  try {
    const state = await getDailyPlansState();
    return NextResponse.json(state);
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function POST(request: Request) {
  const guard = requirePermission(request, "jobs", "select");
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
          return NextResponse.json(
            { error: "INVALID_INPUT", message: "date is required." },
            { status: 400 }
          );
        }
        const result = await saveNote(date, content);
        if (!result.ok) {
          return NextResponse.json(
            { error: result.error.code, message: result.error.message },
            { status: 400 }
          );
        }
        return NextResponse.json({ note: result.data });
      }

      case "activate_plan": {
        const date = String(body.date ?? "");
        if (!date) {
          return NextResponse.json(
            { error: "INVALID_INPUT", message: "date is required." },
            { status: 400 }
          );
        }
        const result = await activatePlan(date);
        if (!result.ok) {
          return NextResponse.json(
            { error: result.error.code, message: result.error.message },
            { status: 400 }
          );
        }
        return NextResponse.json({ activation: result.data });
      }

      case "set_job_override": {
        const jobId = String(body.jobId ?? "");
        const readinessState = body.readinessState as "ready" | "needs-attention" | undefined;
        if (!jobId) {
          return NextResponse.json(
            { error: "INVALID_INPUT", message: "jobId is required." },
            { status: 400 }
          );
        }
        const result = await setJobOverride(jobId, readinessState ?? undefined);
        if (!result.ok) {
          return NextResponse.json(
            { error: result.error.code, message: result.error.message },
            { status: 400 }
          );
        }
        return NextResponse.json({ override: result.data });
      }

      case "mark_packets_sent": {
        const date = String(body.date ?? "");
        if (!date) {
          return NextResponse.json(
            { error: "INVALID_INPUT", message: "date is required." },
            { status: 400 }
          );
        }
        const result = await markPacketsSent(date);
        if (!result.ok) {
          return NextResponse.json(
            { error: result.error.code, message: result.error.message },
            { status: 400 }
          );
        }
        return NextResponse.json({ activation: result.data });
      }

      default:
        return NextResponse.json(
          { error: "INVALID_INPUT", message: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    return mapRouteError(error);
  }
}
