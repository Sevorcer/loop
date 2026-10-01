"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  Filter,
  X,
  XCircle,
} from "lucide-react";

import { useCurrentRole } from "@/features/auth";
import { requestJson } from "@/lib/api/client";

import type { CrewAssignment, DispatchPlan, DispatchSnapshot } from "../types/dispatch";
import { buildDispatchQueueSections, getAssignedCrewLabelForPlan } from "../utils/dispatchWorkspace";
import { filterPlansByDate } from "../utils/dispatchUtils";
import { DispatchBoardCard } from "./DispatchBoardCard";

const BOARD_GROUPS = {
  active: {
    emptyMessage: "No dispatch plans are currently in progress.",
  },
  ready: {
    emptyMessage: "No plans are currently ready for scheduling.",
  },
  scheduled: {
    emptyMessage: "No dispatch plans are currently scheduled.",
  },
  blocked: {
    emptyMessage: "No plans are blocked right now.", }, other: { emptyMessage: "No cancelled plans.",
  },
} as const;

function BoardGroupIcon({
  groupKey,
}: {
  groupKey: "active" | "ready" | "scheduled" | "blocked" | "other";
}) {
  switch (groupKey) {
    case "active":
      return <Clock className="h-4 w-4 text-violet-400" />;
    case "ready":
      return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
    case "scheduled":
      return <CalendarDays className="h-4 w-4 text-blue-400" />;
    case "blocked":
      return <XCircle className="h-4 w-4 text-amber-400" />; case "other": return <XCircle className="h-4 w-4 text-slate-400" />;
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
  const router = useRouter();
  const [plans, setPlans] = useState<DispatchPlan[]>(initialSnapshot.dispatchPlans);
  const [crews] = useState(initialSnapshot.crews);
  const [assignments, setAssignments] = useState<CrewAssignment[]>(
    initialSnapshot.crewAssignments,
  );
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());

  // ── Filters ──────────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "ready" | "scheduled" | "blocked">("all");
  const [crewFilter, setCrewFilter] = useState<string>("all");
  const [jobTypeFilter, setJobTypeFilter] = useState<string>("all");
  const [contractorFilter, setContractorFilter] = useState<string>("all");
  const [technicianFilter, setTechnicianFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");

  const crewNames = useMemo(() => {
    const names = new Set(crews.map((c) => c.name));
    return [...names].sort();
  }, [crews]);

  /**
   * All job types the board can filter by: the canonical set plus anything
   * already present on plans (kept in sync with JobType in features/jobs).
   * Always rendered — an office filter that only appears with enough data
   * trains people to think the feature doesn't exist.
   */
  const jobTypeOptions = useMemo(() => {
    const canonical = [
      "Install",
      "Service",
      "Maintenance",
      "Inspection",
      "Estimate",
      "Callback",
    ];
    return [...new Set([...canonical, ...plans.map((plan) => plan.jobType)])];
  }, [plans]);

  const technicianOptions = useMemo(() => {
    const names = new Set<string>();

    for (const crew of crews) {
      if (crew.leadInstaller) names.add(crew.leadInstaller);
      for (const member of crew.members ?? []) {
        if (member.name) names.add(member.name);
      }
    }

    for (const assignment of assignments) {
      if (assignment.leadInstaller) names.add(assignment.leadInstaller);
      for (const tech of assignment.supportingTechnicians ?? []) {
        names.add(tech);
      }
    }

    return [...names].sort();
  }, [assignments, crews]);

  const contractors = initialSnapshot.contractors ?? [];

  const filteredPlans = useMemo(() => {
    let result = plans;

    if (dateFilter) {
      result = filterPlansByDate(result, dateFilter);
    }

    return result.filter((plan) => {
      if (statusFilter !== "all") {
        const groupMap: Record<string, string[]> = {
          active: ["in_progress"],
          ready: ["ready_to_schedule"],
          scheduled: ["scheduled"],
          blocked: [
            "awaiting_materials",
            "awaiting_technical_readiness",
            "awaiting_customer_confirmation",
            "awaiting_crew_availability",
          ],
        };
        if (!groupMap[statusFilter]?.includes(plan.dispatchStatus)) return false;
      }

      if (crewFilter !== "all") {
        const assigned = assignments.find((a) => a.dispatchPlanId === plan.id);
        if (!assigned || assigned.crewName !== crewFilter) return false;
      }

      if (jobTypeFilter !== "all" && plan.jobType !== jobTypeFilter) {
        return false;
      }

      if (contractorFilter !== "all") {
        const contractorIds = plan.jobId
          ? initialSnapshot.jobContractorIds?.[plan.jobId]
          : undefined;
        if (!contractorIds?.includes(contractorFilter)) return false;
      }

      if (technicianFilter !== "all") {
        const assigned = assignments.find((a) => a.dispatchPlanId === plan.id);
        const onPlan =
          assigned?.leadInstaller === technicianFilter ||
          (assigned?.supportingTechnicians ?? []).includes(technicianFilter);
        if (!onPlan) return false;
      }

      return true;
    });
  }, [
    plans,
    assignments,
    statusFilter,
    crewFilter,
    jobTypeFilter,
    contractorFilter,
    technicianFilter,
    dateFilter,
    initialSnapshot.jobContractorIds,
  ]);

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
        router.refresh();
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
    [assignments, crews, plans, role, router],
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

      const isReschedule = plan.dispatchStatus === "scheduled";
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
            action: isReschedule ? "reschedule" : "schedule",
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
        router.refresh();
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
    [assignments, plans, role, router],
  );

  const sections = buildDispatchQueueSections(filteredPlans);
  const hasActiveFilters =
    statusFilter !== "all" ||
    crewFilter !== "all" ||
    jobTypeFilter !== "all" ||
    contractorFilter !== "all" ||
    technicianFilter !== "all" ||
    !!dateFilter;

  return (
    <div className="space-y-6">
      {/* ── Filter Bar ── */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-1.5 text-xs text-slate-500">
          <Filter className="h-3.5 w-3.5" />
          Filter:
        </span>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="rounded-lg border border-white/10 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-300 outline-none focus:border-blue-500/40"
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          <option value="active">In Progress</option>
          <option value="ready">Ready to Schedule</option>
          <option value="scheduled">Scheduled</option>
          <option value="blocked">Blocked</option>
        </select>

        {crewNames.length > 0 && (
          <select
            value={crewFilter}
            onChange={(e) => setCrewFilter(e.target.value)}
            className="rounded-lg border border-white/10 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-300 outline-none focus:border-blue-500/40"
            aria-label="Filter by crew"
          >
            <option value="all">All crews</option>
            {crewNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        )}

        <select
          value={jobTypeFilter}
          onChange={(e) => setJobTypeFilter(e.target.value)}
          className="rounded-lg border border-white/10 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-300 outline-none focus:border-blue-500/40"
          aria-label="Filter by job type"
        >
          <option value="all">All job types</option>
          {jobTypeOptions.map((jobType) => (
            <option key={jobType} value={jobType}>
              {jobType}
            </option>
          ))}
        </select>

        {contractors.length > 0 && (
          <select
            value={contractorFilter}
            onChange={(e) => setContractorFilter(e.target.value)}
            className="rounded-lg border border-white/10 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-300 outline-none focus:border-blue-500/40"
            aria-label="Filter by contractor"
          >
            <option value="all">All contractors</option>
            {contractors.map((contractor) => (
              <option key={contractor.id} value={contractor.id}>
                {contractor.name}
              </option>
            ))}
          </select>
        )}

        <select
          value={technicianFilter}
          onChange={(e) => setTechnicianFilter(e.target.value)}
          className="rounded-lg border border-white/10 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-300 outline-none focus:border-blue-500/40"
          aria-label="Filter by technician"
        >
          <option value="all">All technicians</option>
          {technicianOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5 text-slate-500" />
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="rounded-lg border border-white/10 bg-slate-950 px-2 py-1.5 text-xs text-slate-300 outline-none focus:border-blue-500/40"
            aria-label="Filter by target date"
          />
          {dateFilter && (
            <button
              type="button"
              onClick={() => setDateFilter("")}
              className="text-xs text-slate-500 hover:text-slate-300"
              aria-label="Clear date filter"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => {
              setStatusFilter("all");
              setCrewFilter("all");
              setJobTypeFilter("all");
              setContractorFilter("all");
              setTechnicianFilter("all");
              setDateFilter("");
            }}
            className="text-xs text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline"
          >
            Clear filters
          </button>
        )}

        <span className="ml-auto text-xs text-slate-600">
          {filteredPlans.length} {filteredPlans.length === 1 ? "plan" : "plans"}
        </span>
      </div>

      {/* ── Sections ── */}
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
                      crewName={getAssignedCrewLabelForPlan(plan, assignments)}
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
