/**
 * Installed Systems API.
 *
 * GET  /api/installed-systems — return all installed systems and technical
 *                               profiles for the caller's org.
 * GET  /api/installed-systems?jobId=<uuid> — only the systems on that job
 *                               (job_id or linked_workflow_ids) and the
 *                               technical profiles they reference. Used by
 *                               the job screens so they no longer download
 *                               every system in the company.
 * POST /api/installed-systems — create a new installed system.
 */

import { NextResponse } from "next/server";

import { requirePermission } from "@/lib/api-auth";
import { invalidJsonResponse, mapRouteError, readJsonObject } from "@/lib/api/routeErrors";
import { emitAuditEvent } from "@/lib/audit";
import {
  createInstalledSystem,
  getInstalledSystemsForJobSnapshot,
  getInstalledSystemsSnapshot,
} from "@/services/installedSystems";
import { getJob } from "@/services/jobs";
import { tryAutoMatchManualsForSystem } from "@/services/manualAutoMatch";

const JOB_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const guard = await requirePermission(request, "installed_systems", "select");
  if (!guard.ok) return guard.response;

  try {
    const jobId = new URL(request.url).searchParams.get("jobId");
    if (jobId !== null) {
      if (!JOB_ID_PATTERN.test(jobId)) {
        return NextResponse.json(
          { error: "VALIDATION", message: "jobId must be a UUID.", code: 400 },
          { status: 400 },
        );
      }
      const scoped = await getInstalledSystemsForJobSnapshot(jobId);
      return NextResponse.json(scoped);
    }

    const snapshot = await getInstalledSystemsSnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    return mapRouteError(error);
  }
}

export async function POST(request: Request) {
  const guard = await requirePermission(request, "installed_systems", "insert");
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    return invalidJsonResponse();
  }

  try {
    const systemName = typeof body.systemName === "string" ? body.systemName.trim() : "";
    if (!systemName) {
      return NextResponse.json(
        { error: "VALIDATION", message: "systemName is required.", code: 400 },
        { status: 400 },
      );
    }

    const manufacturer = typeof body.manufacturer === "string" ? body.manufacturer.trim() : "";
    if (!manufacturer) {
      return NextResponse.json(
        { error: "VALIDATION", message: "manufacturer is required.", code: 400 },
        { status: 400 },
      );
    }

    if (guard.ctx.role === "tech") {
      const jobId = typeof body.jobId === "string" ? body.jobId.trim() : "";
      const job = jobId ? await getJob(jobId) : null;
      if (jobId && !job) {
        return NextResponse.json(
          { error: "forbidden", message: "That job is not assigned to you.", code: 403 },
          { status: 403 },
        );
      }
      const propertyId = typeof body.propertyId === "string" ? body.propertyId.trim() : "";
      const propertyName = typeof body.propertyName === "string" ? body.propertyName.trim() : "";
      if (job && propertyId && job.propertyId && propertyId !== job.propertyId) {
        return NextResponse.json(
          {
            error: "forbidden",
            message: "Installed systems on a job must use that job's property.",
            code: 403,
          },
          { status: 403 },
        );
      }
      if (job && propertyName && job.propertyName && propertyName !== job.propertyName) {
        return NextResponse.json(
          {
            error: "forbidden",
            message: "Installed systems on a job must use that job's property.",
            code: 403,
          },
          { status: 403 },
        );
      }
    }

    const modelNumber = typeof body.modelNumber === "string" ? body.modelNumber.trim() : "";
    if (!modelNumber) {
      return NextResponse.json(
        { error: "VALIDATION", message: "modelNumber is required.", code: 400 },
        { status: 400 },
      );
    }

    // F8: serial numbers are optional — the caller often doesn't have them.
    const serialNumbers = Array.isArray(body.serialNumbers)
      ? (body.serialNumbers as unknown[]).filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      : [];

    const installDate =
      typeof body.installDate === "string" && body.installDate.trim()
        ? body.installDate.trim()
        : "";
    if (!installDate) {
      return NextResponse.json(
        { error: "VALIDATION", message: "installDate is required.", code: 400 },
        { status: 400 },
      );
    }

    const installedSystem = await createInstalledSystem({
      technicalIdentityId:
        typeof body.technicalIdentityId === "string"
          ? body.technicalIdentityId.trim()
          : crypto.randomUUID(),
      technicalProfileId:
        typeof body.technicalProfileId === "string" ? body.technicalProfileId.trim() : "",
      systemName,
      lifecycleStatus:
        typeof body.lifecycleStatus === "string" &&
        ["Planned", "Active", "Needs Review"].includes(body.lifecycleStatus)
          ? (body.lifecycleStatus as "Planned" | "Active" | "Needs Review")
          : "Planned",
      customerName:
        typeof body.customerName === "string" ? body.customerName.trim() : "",
      propertyId:
        typeof body.propertyId === "string" && body.propertyId.trim()
          ? body.propertyId.trim()
          : undefined,
      propertyName:
        typeof body.propertyName === "string" ? body.propertyName.trim() : "",
      location:
        typeof body.location === "string" ? body.location.trim() : "",
      estimateId:
        typeof body.estimateId === "string" && body.estimateId.trim()
          ? body.estimateId.trim()
          : undefined,
      jobId:
        typeof body.jobId === "string" && body.jobId.trim()
          ? body.jobId.trim()
          : undefined,
      jobNumber:
        typeof body.jobNumber === "string" && body.jobNumber.trim()
          ? body.jobNumber.trim()
          : undefined,
      matchState: "unmatched",
      matchConfidence: 0,
      installDate,
      manufacturer,
      modelNumber,
      serialNumbers,
      warrantyRegistered: false, warrantyExpiry:
        typeof body.warrantyExpiry === "string" ? body.warrantyExpiry.trim() : "",
      accessories: Array.isArray(body.accessories)
        ? (body.accessories as unknown[]).filter((a): a is string => typeof a === "string")
        : [],
      linkedWorkflowIds: [],
      permitReady: false,
      operationalHistory: [],
    });

    emitAuditEvent({
      role: guard.ctx.role,
      action: "create",
      resource: "installed_systems",
      resourceId: installedSystem.id,
    });

    // #8 Copilot: link the matching Drive manual (or suggest one) right away.
    const manualMatch = await tryAutoMatchManualsForSystem(installedSystem.id);

    return NextResponse.json({ installedSystem, manualMatch }, { status: 201 });
  } catch (error) {
    return mapRouteError(error);
  }
}
