"use client";

import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

import { Button } from "@/components/ui/button";

import { useDailyPlans } from "../state/DailyPlansProvider";
import {
  addDays,
  formatPlanDate,
  getDayLabel,
  getTodayDate,
  isToday,
} from "../utils/planUtils";

export function DayNavigator() {
  const { selectedDate, setSelectedDate } = useDailyPlans();
  const today = getTodayDate();
  const isOnToday = isToday(selectedDate);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/15 to-blue-500/5 ring-1 ring-white/10">
          <CalendarDays className="h-5 w-5 text-blue-300" />
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            {getDayLabel(selectedDate)}
          </p>
          <p className="text-sm font-medium text-white">
            {formatPlanDate(selectedDate)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSelectedDate(addDays(selectedDate, -1))}
          className="h-9 w-9 rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
          aria-label="Previous day"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {!isOnToday && (
          <Button
            variant="ghost"
            onClick={() => setSelectedDate(today)}
            className="h-9 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white"
          >
            Today
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSelectedDate(addDays(selectedDate, 1))}
          className="h-9 w-9 rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
          aria-label="Next day"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
