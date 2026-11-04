/**
 * Dispatch plan mutations: assign crew, schedule, update status.
 *
 * PATCH /api/dispatch-plans/[id] — mutate a dispatch plan
 *   body.action = "assign_crew"   | assign a crew to this plan
 *   body.action = "schedule"      | create/replace the schedule block
 *   body.action = "update_status" | change dispatch_status
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
import { logWriteFailure } from "@/lib/observability/writes";
import { canAssignDispatchPeople } from "@/features/dispatch/utils/dispatchPeople";
import {
  assignCrewToPlan,
  assignPeopleToJob,
  emitDispatchEvent,
  movePersonBetweenJobs,
  schedulePlan,
} from "@/services/dispatch";
import { getDispatchPlanById, updateDispatchPlanStatus } from "@/repositories/dispatch";
import type { DispatchStatus } from "@/features/dispatch/types/dispatch";
import type { AppRole } from "@/services/authorization";
import { getJobCompletionChecklist } from "@/services/jobs";

/** Roles that bypass the job-completion-gate check on dispatch plan completion. */
const COMPLETION_GATE_BYPASS_ROLES: ReadonlySet<AppRole> = new Set([
  "owner",
  "manager",
  "office",
  "dispatch",
]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requirePermission(request, "jobs", "update");
  if (!guard.ok) return guard.response;

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await readJsonObject(request);
  } catch {
    return invalidJsonResponse();
  }

  const action = String(body.action ?? "");

  try {
    switch (action) {
      case "assign_people":
      case "move_person": {
        if (!canAssignDispatchPeople(guard.ctx.role)) {
          return createApiErrorResponse(
            "FORBIDDEN",
            "Only office staff can assign people to a job.",
            403,
          );
        }
        if (action === "move_person") {
          const personId = String(body.personId ?? "");
          const fromJobId = String(body.fromJobId ?? "");
          const toJobId = String(body.toJobId ?? "");
          const moved = await movePersonBetweenJobs(fromJobId, toJobId, personId);
          try {
            await emitDispatchEvent(
              id,
              "crew_assigned",
              `${moved.personName} moved to ${moved.toJobNumber}.`,
            );
          } catch {
            // The move is already saved.
          }
          return NextResponse.json({ ok: true });
        }
        const jobId = String(body.jobId ?? "");
        const assigneeIds = Array.isArray(body.assigneeIds)
          ? body.assigneeIds.filter((value): value is string => typeof value === "string")
          : [];
        const job = await assignPeopleToJob(jobId, assigneeIds);
        try {
          await emitDispatchEvent(
            id,
            "crew_assigned",
            job.assignedTo.trim()
              ? `${job.assignedTo.trim()} assigned to this job.`
              : "Everyone was removed from this job.",
          );
        } catch {
          // The assignment is already saved.
        }
        return NextResponse.json({ job });
      }

      case "assign_crew": {
        const crewId = String(body.crewId ?? "");
        const crewName = String(body.crewName ?? "");
        const leadInstaller = String(body.leadInstaller ?? "");
        const supporting = (body.supportingTechnicians as string[]) ?? [];
        const jobId = body.jobId as string | undefined;
        const history = (body.reassignmentHistory as import("@/features/dispatch/types/dispatch").ReassignmentRecord[]) ?? [];

        const result = await assignCrewToPlan(id, crewId, crewName, leadInstaller, supporting, jobId, history as never);
        if (!result.ok) {
          return mapRepositoryError(result.error);
        }

        try {
          await emitDispatchEvent(
            id,
            "crew_assigned",
            `${crewName} assigned to plan.`,
          );
        } catch {
          // The assignment is already saved. A log-row failure must not
          // make the board revert the crew the dispatcher just set.
        }

        return NextResponse.json({ assignment: result.data });
      }

      case "reschedule":
      case "schedule": {
        const isReschedule = action === "reschedule";
        const result = await schedulePlan(
          {
            dispatchPlanId: id,
            jobId: body.jobId as string | undefined,
            crewAssignmentId: body.crewAssignmentId as string | undefined,
            crewName: String(body.crewName ?? ""),
            scheduledDate: String(body.scheduledDate ?? ""),
            scheduledStartTime: String(body.scheduledStartTime ?? "07:00"),
            scheduledEndTime: String(body.scheduledEndTime ?? "16:00"),
            estimatedDurationHours: Number(body.estimatedDurationHours ?? 0),
            jobType: String(body.jobType ?? ""),
            customerName: String(body.customerName ?? ""),
            propertyName: String(body.propertyName ?? ""),
            dispatchStatus: "scheduled",
          },
          id
        );

        if (!result.blockResult.ok) {
          return mapRepositoryError(result.blockResult.error);
        }

        try {
          await emitDispatchEvent(
            id,
            isReschedule ? "job_rescheduled" : "job_scheduled",
            isReschedule
              ? `Plan rescheduled to ${String(body.scheduledDate ?? "")}.`
              : `Plan scheduled for ${String(body.scheduledDate ?? "")}.`,
          );
        } catch {
          // Schedule rows are already saved. Keep the board change.
        }

        return NextResponse.json({ block: result.blockResult.data });
      }

      case "update_status": {
        const status = String(body.status ?? "") as DispatchStatus;

        // A tech must not complete a dispatch plan while the job's own
        // completion gates are unmet. Office and above bypass this check.
        if (
          status === "completed" &&
          !COMPLETION_GATE_BYPASS_ROLES.has(guard.ctx.role)
        ) {
          const planResult = await getDispatchPlanById(id);
          if (!planResult.ok) return mapRepositoryError(planResult.error);
          if (!planResult.data) {
            return createApiErrorResponse("NOT_FOUND", `Dispatch plan ${id} not found.`, 404);
          }

          const checklist = await getJobCompletionChecklist(
            planResult.data.jobId,
            guard.ctx.role,
          );

          if (!checklist.canComplete) {
            const blockers: string[] = [];

            if (checklist.finalDayBlocker) {
              blockers.push(checklist.finalDayBlocker);
            }

            if (checklist.closeoutMode === "visit") {
              if (!checklist.jobNotesCompleted) blockers.push("missing job notes");
            } else {
              if (!checklist.photosUploaded) blockers.push("missing at least one photo");
              if (!checklist.installedSystemsEntered) blockers.push("missing installed systems");
              if (!checklist.jobNotesCompleted) blockers.push("missing job notes");
              if (!checklist.requiredQaItemsComplete) blockers.push("incomplete required QA items");
            }

            return createApiErrorResponse(
              "INVALID_INPUT",
              `Cannot complete dispatch plan — ${blockers.join(", ")}.`,
              422,
            );
          }
        }

        const result = await updateDispatchPlanStatus(id, status);
        if (!result.ok) {
          return mapRepositoryError(result.error);
        }
        return NextResponse.json({ plan: result.data });
      }

      default:
        return createApiErrorResponse("INVALID_INPUT", `Unknown action: ${action}`, 400);
    }
  } catch (error) {
    logWriteFailure({ route: "/api/dispatch-plans/[id]", request }, error);
    return mapRouteError(error);
  }
}
