"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { ROUTE_BUILDERS } from "@/lib/routes";
import { cn } from "@/lib/utils";

import type { CalendarTaskEntry, TimeOffEntry } from "../types/calendarEntries";
import type { CalendarBoardItem } from "../utils/calendarEntries";
import { formatEntryTime, taskAssigneeLabel } from "../utils/calendarEntries";
import {
  calendarJobHeading,
  calendarJobSubtitle,
  calendarTechLabel,
  formatCalendarTimeRange,
  formatLongDate,
  isCalendarJobUnassigned,
  relativeDayLabel,
  weekdayLabel,
  type CalendarViewMode,
} from "../utils/calendarSchedule";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type PhoneLayout = "agenda" | "grid";

interface CalendarPhoneProps {
  view: CalendarViewMode;
  weeks: Array<Array<string | null>>;
  itemsByDate: Record<string, CalendarBoardItem[]>;
  selectedDate: string;
  today: string;
  onSelectDate: (date: string) => void;
  onOpenTimeOff: (entry: TimeOffEntry) => void;
  onOpenTask: (entry: CalendarTaskEntry) => void;
}

/**
 * Phone calendar.
 *
 * The office grid is at least 62rem wide and stretches every cell in a week
 * to the tallest day. On a phone only the first couple of columns are on
 * screen, so the blank leading days of the first week become a tall empty
 * block while that week's jobs sit off to the right. This layout keeps every
 * day inside the viewport: an agenda by default, or a fixed-height month grid
 * whose jobs are listed under the day you tap.
 */
export function CalendarPhone({
  view,
  weeks,
  itemsByDate,
  selectedDate,
  today,
  onSelectDate,
  onOpenTimeOff,
  onOpenTask,
}: CalendarPhoneProps) {
  const [layout, setLayout] = useState<PhoneLayout>("agenda");
  const visibleWeeks = weeks.filter((week) => week.some((date) => date !== null));
  const agendaDates =
    view === "week"
      ? visibleWeeks.flat().filter((date): date is string => date !== null)
      : visibleWeeks
          .flat()
          .filter((date): date is string => date !== null && (itemsByDate[date]?.length ?? 0) > 0);

  return (
    <div className="min-w-0 md:hidden">
      <div
        role="group"
        aria-label="Phone calendar layout"
        className="mb-3 inline-flex max-w-full rounded-xl border border-white/10 bg-white/[0.04] p-0.5"
      >
        {(["agenda", "grid"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            aria-pressed={layout === mode}
            onClick={() => setLayout(mode)}
            className={cn(
              "min-h-11 rounded-lg px-4 text-sm font-medium capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]",
              layout === mode ? "bg-accent text-foreground" : "text-muted",
            )}
          >
            {mode}
          </button>
        ))}
      </div>

      {layout === "agenda" ? (
        agendaDates.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-muted">
            {view === "week" ? "Nothing scheduled this week." : "Nothing scheduled this month."}
          </p>
        ) : (
          <div className="space-y-4">
            {agendaDates.map((date) => (
              <PhoneDay
                key={date}
                date={date}
                today={today}
                items={itemsByDate[date] ?? []}
                showEmpty={view === "week"}
                onOpenTimeOff={onOpenTimeOff}
                onOpenTask={onOpenTask}
              />
            ))}
          </div>
        )
      ) : (
        <div className="min-w-0 space-y-3">
          <div className="grid grid-cols-7 gap-1">
            {DAY_LABELS.map((label) => (
              <div
                key={label}
                className="truncate text-center text-[10px] font-semibold uppercase tracking-wide text-muted"
              >
                {label}
              </div>
            ))}
          </div>
          <div className="space-y-1">
            {visibleWeeks.map((week, weekIndex) => (
              <div key={weekIndex} className="grid grid-cols-7 gap-1">
                {week.map((date, dayIndex) => {
                  if (date === null) {
                    return <div key={`empty-${weekIndex}-${dayIndex}`} className="h-12" />;
                  }
                  const count = itemsByDate[date]?.length ?? 0;
                  const dayNumber = Number(date.slice(8, 10));
                  const selected = date === selectedDate;
                  const isToday = date === today;
                  return (
                    <button
                      key={date}
                      type="button"
                      aria-pressed={selected}
                      aria-current={isToday ? "date" : undefined}
                      aria-label={`${weekdayLabel(date)} ${date}, ${count} scheduled`}
                      onClick={() => onSelectDate(date)}
                      className={cn(
                        "flex h-12 min-w-0 flex-col items-center justify-center rounded-lg border text-xs",
                        selected
                          ? "border-blue-500/40 bg-blue-500/10 text-foreground"
                          : isToday
                            ? "border-blue-500/25 bg-blue-500/[0.06] text-accent"
                            : "border-white/[0.06] bg-white/[0.02] text-foreground",
                      )}
                    >
                      <span className="font-semibold leading-none">{dayNumber}</span>
                      {count > 0 ? (
                        <span className="mt-1 text-[10px] font-medium tabular-nums text-muted">{count}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <PhoneDay
            date={selectedDate}
            today={today}
            items={itemsByDate[selectedDate] ?? []}
            showEmpty
            onOpenTimeOff={onOpenTimeOff}
            onOpenTask={onOpenTask}
          />
        </div>
      )}
    </div>
  );
}

function PhoneDay({
  date,
  today,
  items,
  showEmpty,
  onOpenTimeOff,
  onOpenTask,
}: {
  date: string;
  today: string;
  items: CalendarBoardItem[];
  showEmpty: boolean;
  onOpenTimeOff: (entry: TimeOffEntry) => void;
  onOpenTask: (entry: CalendarTaskEntry) => void;
}) {
  if (items.length === 0 && !showEmpty) return null;

  return (
    <section className="min-w-0" aria-label={`${weekdayLabel(date)} ${date}`}>
      <div className="mb-2 min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
          {relativeDayLabel(date, today)}
        </p>
        <h3 className="text-sm font-semibold text-foreground">{formatLongDate(date)}</h3>
      </div>
      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/10 px-4 py-4 text-sm text-muted">
          Nothing scheduled
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={`${item.kind}-${item.id}`} className="min-w-0">
              {item.kind === "job" && item.job ? (
                <PhoneJob date={date} job={item.job} />
              ) : null}
              {item.kind === "time_off" && item.timeOff ? (
                <button
                  type="button"
                  onClick={() => onOpenTimeOff(item.timeOff!)}
                  className="calendar-time-off block min-h-11 w-full min-w-0 rounded-2xl border px-3 py-3 text-left"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Time off</p>
                  <p className="mt-1 text-sm text-foreground">{formatEntryTime(item.timeOff, date)}</p>
                  <p className="mt-0.5 break-words text-sm font-medium text-foreground">{item.timeOff.personName}</p>
                  <p className="break-words text-xs text-muted">{item.timeOff.reason}</p>
                </button>
              ) : null}
              {item.kind === "task" && item.task ? (
                <button
                  type="button"
                  onClick={() => onOpenTask(item.task!)}
                  className="calendar-task block min-h-11 w-full min-w-0 rounded-2xl border px-3 py-3 text-left"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Task{item.task.doneAt ? " · Done" : ""}
                  </p>
                  <p className="mt-1 text-sm text-foreground">{formatEntryTime(item.task, date)}</p>
                  <p className="mt-0.5 break-words text-sm font-medium text-foreground">{item.task.title}</p>
                  <p className="break-words text-xs text-muted">{taskAssigneeLabel(item.task)}</p>
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PhoneJob({
  date,
  job,
}: {
  date: string;
  job: NonNullable<CalendarBoardItem["job"]>;
}) {
  const heading = calendarJobHeading(job);
  const subtitle = calendarJobSubtitle(job);
  return (
    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] text-muted">{formatCalendarTimeRange(job, date)}</p>
          <p className="mt-0.5 break-words text-sm font-medium text-foreground">{heading}</p>
          {subtitle ? <p className="mt-0.5 break-words text-xs text-muted">{subtitle}</p> : null}
          <p className="mt-0.5 break-words text-xs text-muted">{calendarTechLabel(job)}</p>
        </div>
        <Link
          href={ROUTE_BUILDERS.JOB_DETAIL(job.id)}
          aria-label={`Open ${job.jobNumber}`}
          className="inline-flex min-h-11 shrink-0 items-center gap-1 text-xs text-slate-400"
        >
          Open
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      {isCalendarJobUnassigned(job) ? (
        <p className="mt-2 text-[11px] font-medium text-yellow-300">Unassigned</p>
      ) : null}
    </div>
  );
}
