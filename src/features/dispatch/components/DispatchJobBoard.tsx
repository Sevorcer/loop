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

import { useAuth, useCurrentRole } from "@/features/auth";
import { jobTypeFilterLabel } from "@/features/jobs/utils/callbackJob";
import { requestJson } from "@/lib/api/client";
import { pushToast } from "@/components/ui/toast";

import type { CrewAssignment, DispatchAssignee, DispatchPlan, DispatchSnapshot } from "../types/dispatch";
import { buildDispatchQueueSections } from "../utils/dispatchWorkspace";
import { filterPlansByDate } from "../utils/dispatchUtils";
import {
  addDispatchPerson,
  canAssignDispatchPeople,
  moveDispatchPerson,
  persistedAssigneeIds,
  teamLabelForPeople,
  removeDispatchPerson,
  replaceDispatchPerson,
  timeOffForPeople,
} from "../utils/dispatchPeople";
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
    emptyMessage: "No plans are blocked right now.",
  },
  completed: {
    emptyMessage: "No completed jobs for this view.",
  },
  other: { emptyMessage: "No cancelled plans.",
  },
} as const;

function BoardGroupIcon({
  groupKey,
}: {
  groupKey: "active" | "ready" | "scheduled" | "blocked" | "completed" | "other";
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
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-slate-400" />;
    case "other": return <XCircle className="h-4 w-4 text-slate-400" />;
  }
}

interface DispatchJobBoardProps {
  initialSnapshot: DispatchSnapshot;
}

function updatePlan(
  plans: DispatchPlan[],
  planId: string,
  updater: (plan: DispatchPlan) => DispatchPlan,
) {
  return plans.map((plan) => (plan.id === planId ? updater(plan) : plan));
}

export function DispatchJobBoard({ initialSnapshot }: DispatchJobBoardProps) {
  const { role } = useCurrentRole(); const { user } = useAuth();
  const router = useRouter();
  const snapshotStamp = initialSnapshot.dispatchPlans
    .map((plan) => `${plan.id}:${plan.targetDate}:${plan.dispatchStatus}:${plan.updatedAt}`)
    .join("|");
  const [overrideStamp, setOverrideStamp] = useState(snapshotStamp);
  const [planOverrides, setPlanOverrides] = useState<Record<string, DispatchPlan>>({});
  const [assignmentOverride, setAssignmentOverride] = useState<CrewAssignment[] | null>(null);
  if (overrideStamp !== snapshotStamp) {
    setOverrideStamp(snapshotStamp);
    setPlanOverrides({});
    setAssignmentOverride(null);
  }
  const plans = initialSnapshot.dispatchPlans.map((plan) => planOverrides[plan.id] ?? plan);
  const assignments = assignmentOverride ?? initialSnapshot.crewAssignments;
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());

  // ── Filters ──────────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "ready" | "scheduled" | "blocked" | "completed">("all");
  const [jobTypeFilter, setJobTypeFilter] = useState<string>("all");
  const [contractorFilter, setContractorFilter] = useState<string>("all");
  const [technicianFilter, setTechnicianFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");

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
    for (const person of initialSnapshot.people ?? []) {
      if (person.name) names.add(person.name);
    }
    for (const plan of plans) {
      for (const person of plan.assignees ?? []) {
        if (person.name) names.add(person.name);
      }
    }
    return [...names].sort();
  }, [initialSnapshot.people, plans]);

  const contractors = initialSnapshot.contractors ?? [];

  const filteredPlans = useMemo(() => {
    const techNames = new Set([user?.user_metadata?.full_name, user?.email].filter((n): n is string => typeof n === "string").map((n) => n.trim().toLowerCase())); let result = role === "tech" ? plans.filter((plan) => { const pa = assignments.find((a) => a.dispatchPlanId === plan.id); const pn = [...(plan.assignedTechNames ?? []), pa?.leadInstaller, ...(pa?.supportingTechnicians ?? [])].filter((n): n is string => typeof n === "string").map((n) => n.trim().toLowerCase()); return pn.some((n) => techNames.has(n)); }) : plans;

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
          completed: ["completed"],
        };
        if (!groupMap[statusFilter]?.includes(plan.dispatchStatus)) return false;
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
          (assigned?.supportingTechnicians ?? []).includes(technicianFilter) || (plan.assignedTechNames ?? []).includes(technicianFilter);
        if (!onPlan) return false;
      }

      return true;
    });
  }, [
    plans,
    assignments,
    statusFilter,
    jobTypeFilter,
    contractorFilter,
    technicianFilter,
    dateFilter,
    initialSnapshot.jobContractorIds, role, user,
  ]);

  const directory = useMemo(() => initialSnapshot.people ?? [], [initialSnapshot.people]);
  const officeCanAssign = canAssignDispatchPeople(role);

  const peopleFor = useCallback(
    (plan: DispatchPlan): DispatchAssignee[] => planOverrides[plan.id]?.assignees ?? plan.assignees ?? [],
    [planOverrides],
  );

  const savePeople = useCallback(
    async (plan: DispatchPlan, nextPeople: DispatchAssignee[]) => {
      if (!officeCanAssign || !plan.jobId) return;
      const previous = planOverrides;
      setPlanOverrides((current) => ({
        ...current,
        [plan.id]: { ...(current[plan.id] ?? plan), assignees: nextPeople },
      }));
      setUpdatingIds((prev) => new Set(prev).add(plan.id));
      try {
        await requestJson(`/api/dispatch-plans/${plan.id}`, {
          role,
          method: "PATCH",
          body: {
            action: "assign_people",
            jobId: plan.jobId,
            assigneeIds: persistedAssigneeIds(nextPeople),
          },
        });
        router.refresh();
      } catch (error) {
        setPlanOverrides(previous);
        pushToast(
          error instanceof Error ? error.message : "Couldn't save the people on this job.",
          "error",
        );
      } finally {
        setUpdatingIds((prev) => {
          const next = new Set(prev);
          next.delete(plan.id);
          return next;
        });
      }
    },
    [officeCanAssign, planOverrides, role, router],
  );

  const handleAddPerson = useCallback(
    (planId: string, personId: string) => {
      const plan = plans.find((item) => item.id === planId);
      const person = directory.find((item) => item.id === personId);
      if (!plan || !person) return;
      void savePeople(plan, addDispatchPerson(peopleFor(plan), person));
    },
    [directory, peopleFor, plans, savePeople],
  );

  const handleRemovePerson = useCallback(
    (planId: string, personId: string) => {
      const plan = plans.find((item) => item.id === planId);
      if (!plan) return;
      void savePeople(plan, removeDispatchPerson(peopleFor(plan), personId));
    },
    [peopleFor, plans, savePeople],
  );

  const handleReplacePerson = useCallback(
    (planId: string, personId: string, nextPersonId: string) => {
      const plan = plans.find((item) => item.id === planId);
      const person = directory.find((item) => item.id === nextPersonId);
      if (!plan || !person) return;
      void savePeople(plan, replaceDispatchPerson(peopleFor(plan), personId, person));
    },
    [directory, peopleFor, plans, savePeople],
  );

  const handleMovePerson = useCallback(
    async (fromPlanId: string, toPlanId: string, personId: string) => {
      if (!officeCanAssign || fromPlanId === toPlanId) return;
      const source = plans.find((item) => item.id === fromPlanId);
      const target = plans.find((item) => item.id === toPlanId);
      if (!source?.jobId || !target?.jobId) return;
      const moved = moveDispatchPerson(peopleFor(source), peopleFor(target), personId);
      if (!moved) return;
      const previous = planOverrides;
      setPlanOverrides((current) => ({
        ...current,
        [source.id]: { ...(current[source.id] ?? source), assignees: moved.source },
        [target.id]: { ...(current[target.id] ?? target), assignees: moved.target },
      }));
      setUpdatingIds((prev) => new Set(prev).add(source.id).add(target.id));
      try {
        await requestJson(`/api/dispatch-plans/${source.id}`, {
          role,
          method: "PATCH",
          body: {
            action: "move_person",
            personId,
            fromJobId: source.jobId,
            toJobId: target.jobId,
          },
        });
        router.refresh();
      } catch (error) {
        setPlanOverrides(previous);
        pushToast(
          error instanceof Error ? error.message : "Couldn't move that person.",
          "error",
        );
      } finally {
        setUpdatingIds((prev) => {
          const next = new Set(prev);
          next.delete(source.id);
          next.delete(target.id);
          return next;
        });
      }
    },
    [officeCanAssign, peopleFor, planOverrides, plans, role, router],
  );

  const handleSchedulePlan = useCallback(
    async (planId: string, date: string) => {
      if (!role) return;

      const plan = plans.find((item) => item.id === planId);
      const crewAssignment = assignments.find(
        (assignment) => assignment.dispatchPlanId === planId,
      );

      if (!plan) {
        return;
      }

      const isReschedule = plan.dispatchStatus === "scheduled" || plan.dispatchStatus === "completed";
      const crewName =
        teamLabelForPeople(peopleFor(plan)) ||
        crewAssignment?.crewName ||
        "Unassigned";
      const previousPlans = plans;
      setPlanOverrides(
        Object.fromEntries(
          updatePlan(plans, planId, (item) => ({
            ...item,
            dispatchStatus: "scheduled",
            targetDate: date,
          })).map((item) => [item.id, item]),
        ),
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
            crewAssignmentId: crewAssignment?.id,
            crewName,
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
      } catch (error) {
        setPlanOverrides(Object.fromEntries(previousPlans.map((item) => [item.id, item])));
        pushToast(
          error instanceof Error ? error.message : "Couldn't save the schedule change.",
          "error",
        );
      } finally {
        setUpdatingIds((prev) => {
          const next = new Set(prev);
          next.delete(planId);
          return next;
        });
      }
    },
    [assignments, peopleFor, plans, role, router],
  );

  const sections = buildDispatchQueueSections(filteredPlans);
  const hasActiveFilters =
    statusFilter !== "all" ||
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
          <option value="completed">Completed</option>
        </select>

        <select
          value={jobTypeFilter}
          onChange={(e) => setJobTypeFilter(e.target.value)}
          className="rounded-lg border border-white/10 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-300 outline-none focus:border-blue-500/40"
          aria-label="Filter by job type"
        >
          <option value="all">All job types</option>
          {jobTypeOptions.map((jobType) => (
            <option key={jobType} value={jobType}>
              {jobTypeFilterLabel(jobType)}
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
                      people={peopleFor(plan)}
                      directory={directory}
                      timeOff={timeOffForPeople({
                        timeOff: initialSnapshot.timeOff ?? [],
                        people: peopleFor(plan),
                        scheduledStartAt: plan.scheduledStartAt,
                        scheduledEndAt: plan.scheduledEndAt,
                        targetDate: plan.targetDate,
                      })}
                      canAssignPeople={officeCanAssign}
                      onAddPerson={handleAddPerson}
                      onRemovePerson={handleRemovePerson}
                      onReplacePerson={handleReplacePerson}
                      onMovePerson={(fromPlanId, toPlanId, personId) => {
                        void handleMovePerson(fromPlanId, toPlanId, personId);
                      }}
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
