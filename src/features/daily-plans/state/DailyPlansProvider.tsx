"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import type {
  DailyPlanJobOverride,
  DailyPlanNote,
  DailyPlanStoreValue,
} from "../types/dailyPlan";
import { getTodayDate } from "../utils/planUtils";

const DailyPlansContext = createContext<DailyPlanStoreValue | null>(null);

const DAILY_NOTES_STORAGE_KEY = "loop.daily-plans.notes";
const DAILY_OVERRIDES_STORAGE_KEY = "loop.daily-plans.overrides";

const subscribeToHydration = (onStoreChange: () => void) => {
  void onStoreChange;
  return () => {};
};

function parseStoredValue<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    // Local-first Daily Plans state is only written by this app, so we trust the
    // persisted JSON shape and fall back safely if the stored value is malformed.
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function DailyPlansProvider({ children }: { children: ReactNode }) {
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDate);
  const [notes, setNotes] = useState<Record<string, DailyPlanNote>>(() => {
    if (typeof window === "undefined") return {};

    return parseStoredValue<Record<string, DailyPlanNote>>(
      window.localStorage.getItem(DAILY_NOTES_STORAGE_KEY),
      {}
    );
  });
  const [jobOverrides, setJobOverrides] = useState<
    Record<string, DailyPlanJobOverride>
  >(() => {
    if (typeof window === "undefined") return {};

    return parseStoredValue<Record<string, DailyPlanJobOverride>>(
      window.localStorage.getItem(DAILY_OVERRIDES_STORAGE_KEY),
      {}
    );
  });

  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false
  );

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    window.localStorage.setItem(DAILY_NOTES_STORAGE_KEY, JSON.stringify(notes));
  }, [hydrated, notes]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    window.localStorage.setItem(
      DAILY_OVERRIDES_STORAGE_KEY,
      JSON.stringify(jobOverrides)
    );
  }, [hydrated, jobOverrides]);

  const getNote = useCallback(
    (date: string): string => {
      return notes[date]?.content ?? "";
    },
    [notes]
  );

  const saveNote = useCallback((date: string, content: string) => {
    setNotes((current) => ({
      ...current,
      [date]: {
        date,
        content,
        updatedAt: new Date().toISOString(),
      },
    }));
  }, []);

  const getJobOverride = useCallback(
    (jobId: string): DailyPlanJobOverride | undefined => {
      return jobOverrides[jobId];
    },
    [jobOverrides]
  );

  const setJobOverride = useCallback(
    (jobId: string, override: Partial<DailyPlanJobOverride>) => {
      setJobOverrides((current) => ({
        ...current,
        [jobId]: {
          ...current[jobId],
          ...override,
        },
      }));
    },
    []
  );

  const value = useMemo<DailyPlanStoreValue>(
    () => ({
      selectedDate,
      setSelectedDate,
      getNote,
      saveNote,
      getJobOverride,
      setJobOverride,
    }),
    [selectedDate, getNote, saveNote, getJobOverride, setJobOverride]
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
