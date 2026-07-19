"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { mockCrewAssignments } from "../data/mockCrewAssignments";
import { mockCrews } from "../data/mockCrews";
import { mockDispatchEvents } from "../data/mockDispatchEvents";
import { mockDispatchPlans } from "../data/mockDispatchPlans";
import { mockScheduleBlocks } from "../data/mockScheduleBlocks";
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
} from "../types/dispatch";
import {
  assembleDispatchSnapshot,
  getCrewAssignmentForPlan,
  getEventsForPlan,
  getScheduleBlocksForDate,
} from "../utils/dispatchUtils";

const DISPATCH_ASSIGNMENTS_KEY = "loop.dispatch.assignments";
const DISPATCH_EVENTS_KEY = "loop.dispatch.events";
const DISPATCH_SCHEDULE_BLOCKS_KEY = "loop.dispatch.scheduleBlocks";
const DISPATCH_PLAN_STATUS_KEY = "loop.dispatch.planStatusOverrides";

const subscribeToHydration = (onStoreChange: () => void) => {
  void onStoreChange;
  return () => {};
};

function parseStoredValue<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

interface DispatchContextValue {
  snapshot: DispatchSnapshot;
  crews: Crew[];
  getDispatchPlanById: (id: string) => DispatchPlan | undefined;
  getAssignmentForPlan: (dispatchPlanId: string) => CrewAssignment | undefined;
  getScheduleBlocksForDate: (date: string) => ScheduleBlock[];
  getEventsForPlan: (dispatchPlanId: string) => DispatchEvent[];
  assignCrew: (planId: string, crewId: string) => void;
  schedulePlan: (planId: string, date: string) => void;
}

const DispatchContext = createContext<DispatchContextValue | null>(null);

export function DispatchProvider({ children }: { children: ReactNode }) {
  const [assignments, setAssignments] = useState<CrewAssignment[]>(() => {
    if (typeof window === "undefined") return mockCrewAssignments;
    return parseStoredValue<CrewAssignment[]>(
      window.localStorage.getItem(DISPATCH_ASSIGNMENTS_KEY),
      mockCrewAssignments
    );
  });

  const [extraEvents, setExtraEvents] = useState<DispatchEvent[]>(() => {
    if (typeof window === "undefined") return [];
    return parseStoredValue<DispatchEvent[]>(
      window.localStorage.getItem(DISPATCH_EVENTS_KEY),
      []
    );
  });

  const [extraScheduleBlocks, setExtraScheduleBlocks] = useState<ScheduleBlock[]>(() => {
    if (typeof window === "undefined") return [];
    return parseStoredValue<ScheduleBlock[]>(
      window.localStorage.getItem(DISPATCH_SCHEDULE_BLOCKS_KEY),
      []
    );
  });

  const [planStatusOverrides, setPlanStatusOverrides] = useState<Record<string, DispatchStatus>>(() => {
    if (typeof window === "undefined") return {};
    return parseStoredValue<Record<string, DispatchStatus>>(
      window.localStorage.getItem(DISPATCH_PLAN_STATUS_KEY),
      {}
    );
  });

  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false
  );

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(DISPATCH_ASSIGNMENTS_KEY, JSON.stringify(assignments));
  }, [hydrated, assignments]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(DISPATCH_EVENTS_KEY, JSON.stringify(extraEvents));
  }, [hydrated, extraEvents]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(DISPATCH_SCHEDULE_BLOCKS_KEY, JSON.stringify(extraScheduleBlocks));
  }, [hydrated, extraScheduleBlocks]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(DISPATCH_PLAN_STATUS_KEY, JSON.stringify(planStatusOverrides));
  }, [hydrated, planStatusOverrides]);

  const allEvents = useMemo(
    () => [...mockDispatchEvents, ...extraEvents],
    [extraEvents]
  );

  const allScheduleBlocks = useMemo(
    () => [...mockScheduleBlocks, ...extraScheduleBlocks],
    [extraScheduleBlocks]
  );

  const resolvedPlans = useMemo(
    () =>
      mockDispatchPlans.map((plan) => {
        const override = planStatusOverrides[plan.id];
        return override ? { ...plan, dispatchStatus: override } : plan;
      }),
    [planStatusOverrides]
  );

  const snapshot = useMemo(
    () =>
      assembleDispatchSnapshot(
        resolvedPlans,
        assignments,
        allScheduleBlocks,
        allEvents,
        mockCrews
      ),
    [resolvedPlans, assignments, allScheduleBlocks, allEvents]
  );

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

    function assignCrew(planId: string, crewId: string) {
      const plan = snapshot.dispatchPlans.find((p) => p.id === planId);
      const crew = mockCrews.find((c) => c.id === crewId);
      if (!plan || !crew) return;

      const now = new Date().toISOString();
      const existing = getCrewAssignmentForPlan(assignments, planId);

      if (existing) {
        setAssignments((current) =>
          current.map((a) => {
            if (a.dispatchPlanId !== planId) return a;
            const prevCrew = mockCrews.find((c) => c.id === a.crewId);
            return {
              ...a,
              crewId: crew.id,
              crewName: crew.name,
              leadInstaller: crew.leadInstaller,
              status: "confirmed" as AssignmentStatus,
              assignedAt: now,
              reassignmentHistory: [
                ...a.reassignmentHistory,
                {
                  previousCrewId: a.crewId,
                  previousCrewName: prevCrew?.name ?? a.crewName,
                  reassignedAt: now,
                  reason: "Manual reassignment via Dispatch board",
                },
              ],
            };
          })
        );

        const eventType: DispatchEventType = "crew_assigned";
        setExtraEvents((current) => [
          ...current,
          {
            id: `evt-${crypto.randomUUID()}`,
            dispatchPlanId: planId,
            type: eventType,
            timestamp: now,
            description: `Crew reassigned to ${crew.name} for ${plan.jobNumber}.`,
          },
        ]);
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
        setAssignments((current) => [...current, newAssignment]);

        setExtraEvents((current) => [
          ...current,
          {
            id: `evt-${crypto.randomUUID()}`,
            dispatchPlanId: planId,
            type: "crew_assigned" as DispatchEventType,
            timestamp: now,
            description: `${crew.name} assigned to ${plan.jobNumber} — ${plan.customerName}.`,
          },
        ]);
      }
    }

    function schedulePlan(planId: string, date: string) {
      const plan = snapshot.dispatchPlans.find((p) => p.id === planId);
      if (!plan) return;

      const assignment = getCrewAssignmentForPlan(assignments, planId);
      if (!assignment) return;

      const now = new Date().toISOString();

      // Derive a start/end time based on the plan's estimated duration.
      // Default start: 07:00; end: derived from duration.
      const startHour = 7;
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

      setExtraScheduleBlocks((current) => [
        ...current.filter((b) => b.dispatchPlanId !== planId),
        newBlock,
      ]);

      setPlanStatusOverrides((current) => ({
        ...current,
        [planId]: "scheduled",
      }));

      setExtraEvents((current) => [
        ...current,
        {
          id: `evt-${crypto.randomUUID()}`,
          dispatchPlanId: planId,
          type: "job_scheduled" as DispatchEventType,
          timestamp: now,
          description: `${plan.jobNumber} — ${plan.customerName} scheduled for ${date} with ${assignment.crewName}.`,
        },
      ]);
    }

    return {
      snapshot,
      crews: mockCrews,
      getDispatchPlanById,
      getAssignmentForPlan: getAssignmentForPlanFn,
      getScheduleBlocksForDate: getScheduleBlocksForDateFn,
      getEventsForPlan: getEventsForPlanFn,
      assignCrew,
      schedulePlan,
    };
  }, [snapshot, assignments]);

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
