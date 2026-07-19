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

  const allEvents = useMemo(
    () => [...mockDispatchEvents, ...extraEvents],
    [extraEvents]
  );

  const snapshot = useMemo(
    () =>
      assembleDispatchSnapshot(
        mockDispatchPlans,
        assignments,
        mockScheduleBlocks,
        allEvents,
        mockCrews
      ),
    [assignments, allEvents]
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
            id: `evt-${crypto.randomUUID().slice(0, 8)}`,
            dispatchPlanId: planId,
            type: eventType,
            timestamp: now,
            description: `Crew reassigned to ${crew.name} for ${plan.jobNumber}.`,
          },
        ]);
      } else {
        const newAssignment: CrewAssignment = {
          id: `ca-${crypto.randomUUID().slice(0, 8)}`,
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
            id: `evt-${crypto.randomUUID().slice(0, 8)}`,
            dispatchPlanId: planId,
            type: "crew_assigned" as DispatchEventType,
            timestamp: now,
            description: `${crew.name} assigned to ${plan.jobNumber} — ${plan.customerName}.`,
          },
        ]);
      }
    }

    return {
      snapshot,
      crews: mockCrews,
      getDispatchPlanById,
      getAssignmentForPlan: getAssignmentForPlanFn,
      getScheduleBlocksForDate: getScheduleBlocksForDateFn,
      getEventsForPlan: getEventsForPlanFn,
      assignCrew,
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
