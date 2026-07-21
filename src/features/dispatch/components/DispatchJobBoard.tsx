"use client";

import { useCallback, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";

import { useCurrentRole } from "@/features/auth";
import { requestJson } from "@/lib/api/client";

import type { CrewAssignment, DispatchPlan, DispatchSnapshot } from "../types/dispatch";
import { buildDispatchQueueSections, getCrewNameForPlan } from "../utils/dispatchWorkspace";
import { DispatchBoardCard } from "./DispatchBoardCard";

// ---------------------------------------------------------------------------
// Board group definitions — mapped to live job statuses
// ---------------------------------------------------------------------------

const BOARD_GROUPS = {
  active: {
    emptyMessage: "No jobs are currently in progress.",
  },
  ready: {
    emptyMessage: "No plans are currently ready for scheduling.",
  },
  scheduled: {
    emptyMessage: "No work is currently scheduled.",
  },
  blocked: {
    emptyMessage: "No plans are blocked right now.",
  },
} as const;

function BoardGroupIcon({
  groupKey,
}: {
  groupKey: "active" | "ready" | "scheduled" | "blocked";
}) {
  switch (groupKey) {
    case "active":
      return <Clock className="h-4 w-4 text-violet-400" />;
    case "ready":
      return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
    case "scheduled":
      return <CalendarDays className="h-4 w-4 text-blue-400" />;
    case "blocked":
      return <XCircle className="h-4 w-4 text-amber-400" />;
  }
}

interface DispatchJobBoardProps {
  initialSnapshot: DispatchSnapshot;
}

function updateAssignment(
  assignments: CrewAssignment[],
  nextAssignment: CrewAssignment,
): CrewAssignment[] {
  const remaining = assignments.filter(
    (assignment) => assignment.dispatchPlanId !== nextAssignment.dispatchPlanId,
  );

  return [...remaining, nextAssignment];
}

function updatePlan(
  plans: DispatchPlan[],
  planId: string,
  updater: (plan: DispatchPlan) => DispatchPlan,
) {
  return plans.map((plan) => (plan.id === planId ? updater(plan) : plan));
}

export function DispatchJobBoard({ initialSnapshot }: DispatchJobBoardProps) {
  const { role } = useCurrentRole();
  const [plans, setPlans] = useState<DispatchPlan[]>(initialSnapshot.dispatchPlans);
  const [crews] = useState(initialSnapshot.crews);
  const [assignments, setAssignments] = useState<CrewAssignment[]>(
    initialSnapshot.crewAssignments,
  );
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());

  const handleAssignCrew = useCallback(
    async (planId: string, crewId: string) => {
      if (!role) return;

      const crew = crews.find((item) => item.id === crewId);
      const plan = plans.find((item) => item.id === planId);

      if (!crew || !plan) {
        return;
      }

      const previousAssignments = assignments;
      const nextAssignment: CrewAssignment = {
        id:
          previousAssignments.find((assignment) => assignment.dispatchPlanId === planId)?.id ??
          `local-${planId}`,
        dispatchPlanId: planId,
        jobId: plan.jobId,
        crewId: crew.id,
        crewName: crew.name,
        leadInstaller: crew.leadInstaller,
        supportingTechnicians: crew.members
          .filter((member) => member.role !== "lead")
          .map((member) => member.name),
        status: "confirmed",
        assignedAt: new Date().toISOString(),
        reassignmentHistory: [],
      };

      setAssignments((current) => updateAssignment(current, nextAssignment));
      setUpdatingIds((prev) => new Set(prev).add(planId));

      try {
        await requestJson(`/api/dispatch-plans/${planId}`, {
          role,
          method: "PATCH",
          body: {
            action: "assign_crew",
            crewId: crew.id,
            crewName: crew.name,
            leadInstaller: crew.leadInstaller,
            supportingTechnicians: nextAssignment.supportingTechnicians,
            jobId: plan.jobId || undefined,
            reassignmentHistory: nextAssignment.reassignmentHistory,
          },
        });
      } catch {
        setAssignments(previousAssignments);
      } finally {
        setUpdatingIds((prev) => {
          const next = new Set(prev);
          next.delete(planId);
          return next;
        });
      }
    },
    [role, crews, plans, assignments]
  );

  const handleSchedulePlan = useCallback(
    async (planId: string, date: string) => {
      if (!role) return;

      const plan = plans.find((item) => item.id === planId);
      const crewAssignment = assignments.find(
        (assignment) => assignment.dispatchPlanId === planId,
      );

      if (!plan || !crewAssignment) {
        return;
      }

      const previousPlans = plans;
      setPlans((current) =>
        updatePlan(current, planId, (item) => ({
          ...item,
          dispatchStatus: "scheduled",
          targetDate: date,
        })),
      );
      setUpdatingIds((prev) => new Set(prev).add(planId));

      try {
        await requestJson(`/api/dispatch-plans/${planId}`, {
          role,
          method: "PATCH",
          body: {
            action: "schedule",
            dispatchPlanId: planId,
            jobId: plan.jobId || undefined,
            crewAssignmentId: crewAssignment.id,
            crewName: crewAssignment.crewName,
            scheduledDate: date,
            scheduledStartTime: "07:00",
            scheduledEndTime: "16:00",
            estimatedDurationHours: plan.estimatedDurationHours,
            jobType: plan.jobType,
            customerName: plan.customerName,
            propertyName: plan.propertyName,
          },
        });
      } catch {
        setPlans(previousPlans);
      } finally {
        setUpdatingIds((prev) => {
          const next = new Set(prev);
          next.delete(planId);
          return next;
        });
      }
    },
    [role, plans, assignments],
  );

  const sections = buildDispatchQueueSections(plans);

  return (
    <div className="space-y-6">
      {sections.map((section) => {
        return (
          <div key={section.key}>
            <div className="mb-3 flex items-center gap-2">
              <BoardGroupIcon groupKey={section.key} />
              <h4 className="text-sm font-semibold text-slate-300">{section.label}</h4>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs text-slate-500">
                {section.plans.length}
              </span>
              {section.key === "blocked" && section.plans.length > 0 && (
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
              )}
            </div>
            <p className="mb-3 text-xs text-slate-500">{section.description}</p>

            {section.plans.length === 0 ? (
              <div className="rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-5 text-sm text-slate-600">
                {BOARD_GROUPS[section.key].emptyMessage}
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {section.plans.map((plan) => (
                  <div
                    key={plan.id}
                    className={updatingIds.has(plan.id) ? "opacity-70 transition-opacity" : undefined}
                  >
                    <DispatchBoardCard
                      plan={plan}
                      crewName={getCrewNameForPlan(assignments, plan.id)}
                      availableCrews={crews}
                      onAssignCrew={handleAssignCrew}
                      onSchedulePlan={handleSchedulePlan}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
