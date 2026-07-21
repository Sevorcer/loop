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
  DailyPlanActivation,
  DailyPlanJobOverride,
  DailyPlanNote,
  DailyPlanStatus,
  DailyPlanStoreValue,
} from "../types/dailyPlan";
import { getTodayDate } from "../utils/planUtils";

const DailyPlansContext = createContext<DailyPlanStoreValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function DailyPlansProvider({ children }: { children: ReactNode }) {
  const { role } = useCurrentRole();
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDate);

  // In-memory state — loaded from Supabase on mount
  const [notes, setNotes] = useState<Record<string, DailyPlanNote>>({});
  const [jobOverrides, setJobOverrides] = useState<Record<string, DailyPlanJobOverride>>({});
  const [activations, setActivations] = useState<
    Record<string, DailyPlanActivation & { packetsSent?: boolean }>
  >({});

  // ---------------------------------------------------------------------------
  // Initial load — pull full state from /api/daily-plans
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!role) return;

    void (async () => {
      try {
        const state = await requestJson<{
          notes: Record<string, DailyPlanNote>;
          activations: Record<string, DailyPlanActivation & { packetsSent: boolean }>;
          jobOverrides: Record<string, DailyPlanJobOverride>;
        }>("/api/daily-plans", { role, cache: "no-store" });

        setNotes(state.notes ?? {});
        setActivations(state.activations ?? {});
        setJobOverrides(state.jobOverrides ?? {});
      } catch {
        // Supabase not configured or network failure — start with empty state.
        // Existing UI will show as empty (no data) rather than crashing.
      }
    })();
  }, [role]);

  // ---------------------------------------------------------------------------
  // Notes
  // ---------------------------------------------------------------------------

  const getNote = useCallback(
    (date: string): string => notes[date]?.content ?? "",
    [notes]
  );

  const saveNote = useCallback(
    (date: string, content: string) => {
      // Optimistic update
      setNotes((current) => ({
        ...current,
        [date]: { date, content, updatedAt: new Date().toISOString() },
      }));

      if (!role) return;
      void requestJson("/api/daily-plans", {
        role,
        method: "POST",
        body: { action: "save_note", date, content },
      }).catch(() => {
        // Persistence failure — optimistic state remains for session
      });
    },
    [role]
  );

  // ---------------------------------------------------------------------------
  // Job overrides
  // ---------------------------------------------------------------------------

  const getJobOverride = useCallback(
    (jobId: string): DailyPlanJobOverride | undefined => jobOverrides[jobId],
    [jobOverrides]
  );

  const setJobOverride = useCallback(
    (jobId: string, override: Partial<DailyPlanJobOverride>) => {
      setJobOverrides((current) => ({
        ...current,
        [jobId]: { ...current[jobId], ...override },
      }));

      if (!role) return;
      void requestJson("/api/daily-plans", {
        role,
        method: "POST",
        body: {
          action: "set_job_override",
          jobId,
          readinessState: override.readinessState ?? null,
        },
      }).catch(() => {});
    },
    [role]
  );

  // ---------------------------------------------------------------------------
  // Plan activations
  // ---------------------------------------------------------------------------

  const getPlanStatus = useCallback(
    (date: string): DailyPlanStatus => activations[date]?.status ?? "planning",
    [activations]
  );

  const getPlanActivation = useCallback(
    (date: string): DailyPlanActivation | undefined => {
      const a = activations[date];
      if (!a) return undefined;
      return { date: a.date, status: a.status, startedAt: a.startedAt };
    },
    [activations]
  );

  const activatePlan = useCallback(
    (date: string) => {
      const now = new Date().toISOString();
      setActivations((current) => ({
        ...current,
        [date]: { date, status: "active", startedAt: now, packetsSent: false },
      }));

      if (!role) return;
      void requestJson("/api/daily-plans", {
        role,
        method: "POST",
        body: { action: "activate_plan", date },
      }).catch(() => {});
    },
    [role]
  );

  // ---------------------------------------------------------------------------
  // Packets sent
  // ---------------------------------------------------------------------------

  const getPacketsSent = useCallback(
    (date: string): boolean => activations[date]?.packetsSent ?? false,
    [activations]
  );

  const markPacketsSent = useCallback(
    (date: string) => {
      setActivations((current) => ({
        ...current,
        [date]: {
          date,
          status: current[date]?.status ?? "active",
          startedAt: current[date]?.startedAt ?? new Date().toISOString(),
          packetsSent: true,
        },
      }));

      if (!role) return;
      void requestJson("/api/daily-plans", {
        role,
        method: "POST",
        body: { action: "mark_packets_sent", date },
      }).catch(() => {});
    },
    [role]
  );

  // ---------------------------------------------------------------------------
  // Context value
  // ---------------------------------------------------------------------------

  const value = useMemo<DailyPlanStoreValue>(
    () => ({
      selectedDate,
      setSelectedDate,
      getNote,
      saveNote,
      getJobOverride,
      setJobOverride,
      getPlanStatus,
      getPlanActivation,
      activatePlan,
      getPacketsSent,
      markPacketsSent,
    }),
    [
      selectedDate,
      getNote,
      saveNote,
      getJobOverride,
      setJobOverride,
      getPlanStatus,
      getPlanActivation,
      activatePlan,
      getPacketsSent,
      markPacketsSent,
    ]
  );

  return (
    <DailyPlansContext.Provider value={value}>
      {children}
    </DailyPlansContext.Provider>
  );
}

export function useDailyPlans() {
  const context = useContext(DailyPlansContext);

  if (!context) {
    throw new Error("useDailyPlans must be used within a DailyPlansProvider");
  }

  return context;
}
