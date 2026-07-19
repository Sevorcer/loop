"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import type { DailyPlanNote, DailyPlanStoreValue } from "../types/dailyPlan";
import { getTodayDate } from "../utils/planUtils";

const DailyPlansContext = createContext<DailyPlanStoreValue | null>(null);

const DAILY_NOTES_STORAGE_KEY = "loop.daily-plans.notes";

const subscribeToHydration = (onStoreChange: () => void) => {
  void onStoreChange;
  return () => {};
};

function parseStoredNotes(value: string | null): Record<string, DailyPlanNote> {
  if (!value) return {};

  try {
    return JSON.parse(value) as Record<string, DailyPlanNote>;
  } catch {
    return {};
  }
}

export function DailyPlansProvider({ children }: { children: ReactNode }) {
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDate);

  const [notes, setNotes] = useState<Record<string, DailyPlanNote>>(() => {
    if (typeof window === "undefined") return {};

    return parseStoredNotes(window.localStorage.getItem(DAILY_NOTES_STORAGE_KEY));
  });

  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false
  );

  const getNote = useCallback(
    (date: string): string => {
      return notes[date]?.content ?? "";
    },
    [notes]
  );

  const saveNote = useCallback(
    (date: string, content: string) => {
      const updatedNotes: Record<string, DailyPlanNote> = {
        ...notes,
        [date]: {
          date,
          content,
          updatedAt: new Date().toISOString(),
        },
      };

      setNotes(updatedNotes);

      if (hydrated && typeof window !== "undefined") {
        window.localStorage.setItem(
          DAILY_NOTES_STORAGE_KEY,
          JSON.stringify(updatedNotes)
        );
      }
    },
    [hydrated, notes]
  );

  const value = useMemo<DailyPlanStoreValue>(
    () => ({
      selectedDate,
      setSelectedDate,
      getNote,
      saveNote,
    }),
    [selectedDate, getNote, saveNote]
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
