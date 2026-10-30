"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { JobType } from "@/features/jobs/types/job";
import { getCalendarMonthGrid } from "@/features/daily-plans/utils/planUtils";
import { cn } from "@/lib/utils";

import type { CalendarTaskEntry, TimeOffEntry } from "../types/calendarEntries";
import type { CalendarBoardItem } from "../utils/calendarEntries";
import {
  isCalendarJobUnassigned,
  type CalendarViewMode,
  weekdayLabel,
} from "../utils/calendarSchedule";
import { TaskCard, TimeOffCard } from "./CalendarEntryCards";
import { CalendarJobCard, JOB_TYPE_DOT } from "./CalendarJobCard";
import { CalendarPhone } from "./CalendarPhone";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const JOB_TYPE_LEGEND: JobType[] = [
  "Install",
  "Service",
  "Maintenance",
  "Inspection",
  "Estimate",
  "Callback",
];

interface CalendarGridProps {
  view: CalendarViewMode;
  /** 0-indexed month, used by the month view. */
  month: number;
  year: number;
  /** Any day in the week to show. Ignored while the month view is active. */
  weekDates: string[];
  title: string;
  /** Jobs, time off, and tasks already grouped and sorted for each company date. */
  itemsByDate: Record<string, CalendarBoardItem[]>;
  selectedDate: string;
  today: string;
  showToday: boolean;
  onSelectDate?: (date: string) => void;
  onViewChange?: (view: CalendarViewMode) => void;
  onPrev?: () => void;
  onNext?: () => void;
  onToday?: () => void;
  onAdd?: () => void;
  onOpenTimeOff?: (entry: TimeOffEntry) => void;
  onOpenTask?: (entry: CalendarTaskEntry) => void;
}

export function CalendarGrid({
  view,
  month,
  year,
  weekDates,
  title,
  itemsByDate,
  selectedDate,
  today,
  showToday,
  onSelectDate = () => {},
  onViewChange = () => {},
  onPrev = () => {},
  onNext = () => {},
  onToday = () => {},
  onAdd,
  onOpenTimeOff = () => {},
  onOpenTask = () => {},
}: CalendarGridProps) {
  const weeks =
    view === "week"
      ? [weekDates]
      : getCalendarMonthGrid(year, month);
  const periodLabel = view === "week" ? "week" : "month";

  return (
    <section
      className="calendar-board min-w-0 rounded-3xl border border-white/10 bg-white/[0.02] p-4 sm:p-5 print:border-neutral-300 print:bg-white print:p-0"
      aria-label={view === "week" ? "Week calendar" : "Month calendar"}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>

          <div className="flex flex-wrap items-center gap-1.5 print:hidden">
            {onAdd ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={onAdd}
                className="h-8 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs text-slate-300 hover:bg-white/10 max-md:h-11"
              >
                + Add
              </Button>
            ) : null}
          <div
            role="group"
            aria-label="Calendar view"
            className="inline-flex rounded-xl border border-white/10 bg-white/[0.04] p-0.5"
          >
            {(["month", "week"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={view === mode}
                onClick={() => onViewChange(mode)}
                className={cn(
                  "rounded-lg px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] max-md:min-h-11 max-md:px-4",
                  view === mode ? "bg-accent" : "text-muted hover:text-foreground",
                )}
              >
                {mode === "month" ? "Month" : "Week"}
              </button>
            ))}
          </div>
          {showToday ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToday}
              className="h-8 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs text-slate-300 hover:bg-white/10 max-md:h-11"
            >
              Today
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            onClick={onPrev}
            aria-label={`Previous ${periodLabel}`}
            className="h-8 w-8 rounded-xl border border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/10 hover:text-white max-md:h-11 max-md:w-11"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onNext}
            aria-label={`Next ${periodLabel}`}
            className="h-8 w-8 rounded-xl border border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/10 hover:text-white max-md:h-11 max-md:w-11"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        {JOB_TYPE_LEGEND.map((type) => (
          <span
            key={type}
            className="inline-flex items-center gap-1 text-[10px] font-medium text-muted"
          >
            <span className={cn("h-2 w-2 rounded-full", JOB_TYPE_DOT[type])} />
            {type}
          </span>
        ))}
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted">
          <span className="calendar-time-off h-2 w-3 rounded-sm border" />
          Time off
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted">
          <span className="calendar-task h-2 w-3 rounded-sm border" />
          Task
        </span>
      </div>

      <CalendarPhone
        view={view}
        weeks={weeks}
        itemsByDate={itemsByDate}
        selectedDate={selectedDate}
        today={today}
        onSelectDate={onSelectDate}
        onOpenTimeOff={onOpenTimeOff}
        onOpenTask={onOpenTask}
      />

      <div className="hidden min-w-0 overflow-x-auto md:block print:overflow-visible">
        <div className="min-w-[62rem] print:min-w-0">
          {view === "month" ? (
            <div className="mb-1 grid grid-cols-7 gap-2">
              {DAY_LABELS.map((label) => (
                <div
                  key={label}
                  className="py-1 text-center text-[10px] font-semibold uppercase tracking-[0.15em] text-muted"
                >
                  {label}
                </div>
              ))}
            </div>
          ) : null}

          <div className="space-y-2">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="grid grid-cols-7 items-stretch gap-2">
                {week.map((date, dayIndex) => {
                  if (date === null) {
                    return (
                      <div
                        key={`empty-${weekIndex}-${dayIndex}`}
                        className="min-h-24 rounded-xl"
                      />
                    );
                  }

                  const dayItems = itemsByDate[date] ?? [];
                  return (
                    <CalendarDay
                      key={date}
                      date={date}
                      items={dayItems}
                      view={view}
                      isSelected={date === selectedDate}
                      isToday={date === today}
                      onSelectDate={onSelectDate}
                      onOpenTimeOff={onOpenTimeOff}
                      onOpenTask={onOpenTask}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function CalendarDay({
  date,
  items,
  view,
  isSelected,
  isToday,
  onSelectDate,
  onOpenTimeOff,
  onOpenTask,
}: {
  date: string;
  items: CalendarBoardItem[];
  view: CalendarViewMode;
  isSelected: boolean;
  isToday: boolean;
  onSelectDate: (date: string) => void;
  onOpenTimeOff: (entry: TimeOffEntry) => void;
  onOpenTask: (entry: CalendarTaskEntry) => void;
}) {
  const dayNumber = Number(date.slice(8, 10));
  const jobs = items.flatMap((item) => (item.kind === "job" && item.job ? [item.job] : []));
  const unassigned = jobs.filter((job) => isCalendarJobUnassigned(job)).length;
  const weekday = weekdayLabel(date);

  return (
    <div
      role="group"
      aria-label={`${weekday} ${date}, ${items.length} scheduled`}
      onClick={() => onSelectDate(date)}
      className={cn(
        "flex h-full min-w-0 cursor-pointer flex-col rounded-xl border px-1.5 py-1.5 text-left transition-colors",
        view === "week" ? "min-h-64 px-2 py-2" : "min-h-28",
        isSelected
          ? "border-blue-500/40 bg-blue-500/10"
          : isToday
            ? "border-blue-500/25 bg-blue-500/[0.06]"
            : "border-white/[0.06] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.05]",
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onSelectDate(date);
          }}
          aria-pressed={isSelected}
          aria-current={isToday ? "date" : undefined}
          aria-controls="calendar-day-panel"
          className={cn(
            "rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]",
            isToday ? "text-accent" : "text-foreground",
          )}
        >
          {view === "week" ? (
            <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              {weekday}
            </span>
          ) : null}
          <span className={cn("font-semibold leading-none", view === "week" ? "text-lg" : "text-xs")}>
            {dayNumber}
          </span>
        </button>
        {items.length > 0 ? (
          <span className="text-[10px] font-medium tabular-nums text-muted">{items.length}</span>
        ) : null}
      </div>

      {items.length === 0 && view === "week" ? (
        <p className="px-0.5 py-3 text-xs text-muted">Nothing scheduled</p>
      ) : null}

      {items.length > 0 ? (
        <ul className={cn("mt-1.5 flex flex-col", view === "week" ? "gap-1.5" : "gap-1")}>
          {items.map((item) => (
            <li key={`${item.kind}-${item.id}`} className="min-w-0">
              {item.kind === "job" && item.job ? (
                <CalendarJobCard
                  job={item.job}
                  onDate={date}
                  density={view === "week" ? "comfortable" : "compact"}
                />
              ) : null}
              {item.kind === "time_off" && item.timeOff ? (
                <TimeOffCard
                  entry={item.timeOff}
                  onDate={date}
                  density={view === "week" ? "comfortable" : "compact"}
                  onOpen={onOpenTimeOff}
                />
              ) : null}
              {item.kind === "task" && item.task ? (
                <TaskCard
                  entry={item.task}
                  onDate={date}
                  density={view === "week" ? "comfortable" : "compact"}
                  onOpen={onOpenTask}
                />
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {unassigned > 0 ? (
        <p className="mt-1.5 text-[10px] font-medium leading-snug text-yellow-400">
          {unassigned} unassigned
        </p>
      ) : null}
    </div>
  );
}
