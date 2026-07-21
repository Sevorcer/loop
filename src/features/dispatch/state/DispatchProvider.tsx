"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useCurrentRole } from "@/features/auth";
import { requestJson } from "@/lib/api/client";

import type {
  AssignmentStatus,
  Crew,
  CrewAssignment,
  DispatchEvent,
  DispatchEventType,
  DispatchPlan,
  DispatchSnapshot,
  DispatchStatus,
  ScheduleBlock,
  ReassignmentRecord,
} from "../types/dispatch";
import {
  assembleDispatchSnapshot,
  getCrewAssignmentForPlan,
  getEventsForPlan,
  getScheduleBlocksForDate,
} from "../utils/dispatchUtils";

/** Default crew start hour for scheduled jobs (07:00 local time). */
const DEFAULT_SCHEDULE_START_HOUR = 7;

interface DispatchContextValue {
  snapshot: DispatchSnapshot;
  crews: Crew[];
  loading: boolean;
  getDispatchPlanById: (id: string) => DispatchPlan | undefined;
  getAssignmentForPlan: (dispatchPlanId: string) => CrewAssignment | undefined;
  getScheduleBlocksForDate: (date: string) => ScheduleBlock[];
  getEventsForPlan: (dispatchPlanId: string) => DispatchEvent[];
  assignCrew: (planId: string, crewId: string) => void;
  schedulePlan: (planId: string, date: string) => void;
}

const DispatchContext = createContext<DispatchContextValue | null>(null);

// ---------------------------------------------------------------------------
// Empty snapshot used as initial state
// ---------------------------------------------------------------------------
const EMPTY_SNAPSHOT: DispatchSnapshot = {
  dispatchPlans: [],
  crewAssignments: [],
  scheduleBlocks: [],
  dispatchEvents: [],
  crews: [],
  metrics: {
    readyToSchedule: 0,
    scheduled: 0,
    inProgress: 0,
    awaitingMaterials: 0,
    awaitingCustomer: 0,
    awaitingCrew: 0,
    totalPlans: 0,
  },
};

export function DispatchProvider({ children }: { children: ReactNode }) {
  const { role } = useCurrentRole();

  const [plans, setPlans] = useState<DispatchPlan[]>([]);
  const [crews, setCrews] = useState<Crew[]>([]);
  const [assignments, setAssignments] = useState<CrewAssignment[]>([]);
  const [scheduleBlocks, setScheduleBlocks] = useState<ScheduleBlock[]>([]);
  const [events, setEvents] = useState<DispatchEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // ---------------------------------------------------------------------------
  // Initial load
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!role) return;

    void (async () => {
      setLoading(true);
      try {
        const data = await requestJson<{
          plans: DispatchPlan[];
          crews: Crew[];
          assignments: CrewAssignment[];
          scheduleBlocks: ScheduleBlock[];
          events: DispatchEvent[];
        }>("/api/dispatch-plans", { role, cache: "no-store" });

        setPlans(data.plans ?? []);
        setCrews(data.crews ?? []);
        setAssignments(data.assignments ?? []);
        setScheduleBlocks(data.scheduleBlocks ?? []);
        setEvents(data.events ?? []);
      } catch {
        // Supabase not configured or network failure — start empty.
      } finally {
        setLoading(false);
      }
    })();
  }, [role]);

  // ---------------------------------------------------------------------------
  // Derived snapshot
  // ---------------------------------------------------------------------------

  const snapshot = useMemo(
    () => assembleDispatchSnapshot(plans, assignments, scheduleBlocks, events, crews),
    [plans, crews, assignments, scheduleBlocks, events]
  );

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  const assignCrew = useCallback(
    (planId: string, crewId: string) => {
      const plan = plans.find((p) => p.id === planId);
      const crew = crews.find((c) => c.id === crewId);
      if (!plan || !crew) return;

      const now = new Date().toISOString();
      const existing = getCrewAssignmentForPlan(assignments, planId);

      let newAssignments: CrewAssignment[];
      let history: ReassignmentRecord[] = [];

      if (existing) {
        history = [
          ...existing.reassignmentHistory,
          {
            previousCrewId: existing.crewId,
            previousCrewName: existing.crewName,
            reassignedAt: now,
            reason: "Manual reassignment via Dispatch board",
          },
        ];
        newAssignments = assignments.map((a) =>
          a.dispatchPlanId !== planId
            ? a
            : {
                ...a,
                crewId: crew.id,
                crewName: crew.name,
                leadInstaller: crew.leadInstaller,
                status: "confirmed" as AssignmentStatus,
                assignedAt: now,
                reassignmentHistory: history,
              }
        );
      } else {
        const newAssignment: CrewAssignment = {
          id: `ca-${crypto.randomUUID()}`,
          dispatchPlanId: planId,
          jobId: plan.jobId,
          crewId: crew.id,
          crewName: crew.name,
          leadInstaller: crew.leadInstaller,
          supportingTechnicians: crew.members
            .filter((m) => m.role !== "lead")
            .map((m) => m.name),
          status: "confirmed",
          assignedAt: now,
          reassignmentHistory: [],
        };
        newAssignments = [...assignments, newAssignment];
        history = [];
      }

      // Optimistic update
      setAssignments(newAssignments);
      const eventDescription = existing
        ? `Crew reassigned to ${crew.name} for ${plan.jobNumber}.`
        : `${crew.name} assigned to ${plan.jobNumber} — ${plan.customerName}.`;

      setEvents((current) => [
        ...current,
        {
          id: `evt-${crypto.randomUUID()}`,
          dispatchPlanId: planId,
          type: "crew_assigned" as DispatchEventType,
          timestamp: now,
          description: eventDescription,
        },
      ]);

      if (!role) return;
      void requestJson(`/api/dispatch-plans/${planId}`, {
        role,
        method: "PATCH",
        body: {
          action: "assign_crew",
          crewId: crew.id,
          crewName: crew.name,
          leadInstaller: crew.leadInstaller,
          supportingTechnicians: crew.members
            .filter((m) => m.role !== "lead")
            .map((m) => m.name),
          jobId: plan.jobId || undefined,
          reassignmentHistory: history,
        },
      }).catch(() => {});
    },
    [plans, crews, assignments, role]
  );

  const schedulePlan = useCallback(
    (planId: string, date: string) => {
      const plan = plans.find((p) => p.id === planId);
      if (!plan) return;

      const assignment = getCrewAssignmentForPlan(assignments, planId);
      if (!assignment) return;

      const now = new Date().toISOString();
      const startHour = DEFAULT_SCHEDULE_START_HOUR;
      const endHour = startHour + plan.estimatedDurationHours;
      const pad = (n: number) => String(Math.floor(n)).padStart(2, "0");
      const scheduledStartTime = `${pad(startHour)}:00`;
      const scheduledEndTime = `${pad(endHour)}:00`;

      const newBlock: ScheduleBlock = {
        id: `sb-${crypto.randomUUID()}`,
        dispatchPlanId: planId,
        jobId: plan.jobId,
        crewAssignmentId: assignment.id,
        crewName: assignment.crewName,
        scheduledDate: date,
        scheduledStartTime,
        scheduledEndTime,
        estimatedDurationHours: plan.estimatedDurationHours,
        jobType: plan.jobType,
        customerName: plan.customerName,
        propertyName: plan.propertyName,
        dispatchStatus: "scheduled",
      };

      // Optimistic update
      setScheduleBlocks((current) => [
        ...current.filter((b) => b.dispatchPlanId !== planId),
        newBlock,
      ]);
      setPlans((current) =>
        current.map((p) =>
          p.id !== planId ? p : { ...p, dispatchStatus: "scheduled" as DispatchStatus }
        )
      );
      setEvents((current) => [
        ...current,
        {
          id: `evt-${crypto.randomUUID()}`,
          dispatchPlanId: planId,
          type: "job_scheduled" as DispatchEventType,
          timestamp: now,
          description: `${plan.jobNumber} — ${plan.customerName} scheduled for ${date} with ${assignment.crewName}.`,
        },
      ]);

      if (!role) return;
      void requestJson(`/api/dispatch-plans/${planId}`, {
        role,
        method: "PATCH",
        body: {
          action: "schedule",
          jobId: plan.jobId || undefined,
          crewAssignmentId: assignment.id,
          crewName: assignment.crewName,
          scheduledDate: date,
          scheduledStartTime,
          scheduledEndTime,
          estimatedDurationHours: plan.estimatedDurationHours,
          jobType: plan.jobType,
          customerName: plan.customerName,
          propertyName: plan.propertyName,
        },
      }).catch(() => {});
    },
    [plans, assignments, role]
  );

  // ---------------------------------------------------------------------------
  // Context value
  // ---------------------------------------------------------------------------

  const value = useMemo<DispatchContextValue>(() => {
    function getDispatchPlanById(id: string) {
      return snapshot.dispatchPlans.find((p) => p.id === id);
    }

    function getAssignmentForPlanFn(dispatchPlanId: string) {
      return getCrewAssignmentForPlan(snapshot.crewAssignments, dispatchPlanId);
    }

    function getScheduleBlocksForDateFn(date: string) {
      return getScheduleBlocksForDate(snapshot.scheduleBlocks, date);
    }

    function getEventsForPlanFn(dispatchPlanId: string) {
      return getEventsForPlan(snapshot.dispatchEvents, dispatchPlanId);
    }

    return {
      snapshot: plans.length > 0 ? snapshot : EMPTY_SNAPSHOT,
      crews,
      loading,
      getDispatchPlanById,
      getAssignmentForPlan: getAssignmentForPlanFn,
      getScheduleBlocksForDate: getScheduleBlocksForDateFn,
      getEventsForPlan: getEventsForPlanFn,
      assignCrew,
      schedulePlan,
    };
  }, [snapshot, plans, crews, loading, assignCrew, schedulePlan]);

  return (
    <DispatchContext.Provider value={value}>
      {children}
    </DispatchContext.Provider>
  );
}

export function useDispatch() {
  const context = useContext(DispatchContext);

  if (!context) {
    throw new Error("useDispatch must be used within a DispatchProvider");
  }

  return context;
}

