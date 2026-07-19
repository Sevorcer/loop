"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

import { mockCrewAssignments } from "../data/mockCrewAssignments";
import { mockCrews } from "../data/mockCrews";
import { mockDispatchEvents } from "../data/mockDispatchEvents";
import { mockDispatchPlans } from "../data/mockDispatchPlans";
import { mockScheduleBlocks } from "../data/mockScheduleBlocks";
import type {
  CrewAssignment,
  DispatchEvent,
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

interface DispatchContextValue {
  snapshot: DispatchSnapshot;
  getDispatchPlanById: (id: string) => DispatchPlan | undefined;
  getAssignmentForPlan: (dispatchPlanId: string) => CrewAssignment | undefined;
  getScheduleBlocksForDate: (date: string) => ScheduleBlock[];
  getEventsForPlan: (dispatchPlanId: string) => DispatchEvent[];
}

const DispatchContext = createContext<DispatchContextValue | null>(null);

export function DispatchProvider({ children }: { children: ReactNode }) {
  const snapshot = useMemo(
    () =>
      assembleDispatchSnapshot(
        mockDispatchPlans,
        mockCrewAssignments,
        mockScheduleBlocks,
        mockDispatchEvents,
        mockCrews
      ),
    []
  );

  const value = useMemo<DispatchContextValue>(() => {
    function getDispatchPlanById(id: string) {
      return snapshot.dispatchPlans.find((p) => p.id === id);
    }

    function getAssignmentForPlan(dispatchPlanId: string) {
      return getCrewAssignmentForPlan(snapshot.crewAssignments, dispatchPlanId);
    }

    function getScheduleBlocksForDateFn(date: string) {
      return getScheduleBlocksForDate(snapshot.scheduleBlocks, date);
    }

    function getEventsForPlanFn(dispatchPlanId: string) {
      return getEventsForPlan(snapshot.dispatchEvents, dispatchPlanId);
    }

    return {
      snapshot,
      getDispatchPlanById,
      getAssignmentForPlan,
      getScheduleBlocksForDate: getScheduleBlocksForDateFn,
      getEventsForPlan: getEventsForPlanFn,
    };
  }, [snapshot]);

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
