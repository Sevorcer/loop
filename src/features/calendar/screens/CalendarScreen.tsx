"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, CalendarRange, ListFilter, UserCircle2 } from "lucide-react";

import { PageHeader, StatusBadge } from "@/components/atlas";
import { useJobs } from "@/features/jobs/state/JobsProvider";
import type { Job } from "@/features/jobs/types/job";
import { todayInCompanyTimeZone } from "@/lib/timezone";
import { ROUTE_BUILDERS, ROUTES } from "@/lib/routes";

import { CalendarGrid } from "../components/CalendarGrid";
import {
  CALENDAR_VIEW_STORAGE_KEY,
  calendarJobHeading,
  calendarJobSubtitle,
  calendarTechLabel,
  formatCalendarTimeRange,
  formatLongDate,
  formatMonthTitle,
  formatWeekRangeLabel,
  groupJobsByDate,
  isCalendarJobUnassigned,
  isJobScheduled,
  relativeDayLabel,
  resolveCalendarView,
  shiftDate,
  weekDates,
  type CalendarViewMode,
} from "../utils/calendarSchedule";

const CALENDAR_VIEW_PENDING = "pending" as const;

const calendarViewListeners = new Set<() => void>();
let rememberedCalendarView: CalendarViewMode | null = null;

function subscribeCalendarView(listener: () => void) {
  calendarViewListeners.add(listener);
  return () => {
    calendarViewListeners.delete(listener);
  };
}

function emitCalendarView() {
  for (const listener of calendarViewListeners) listener();
}

function readInitialCalendarView(): CalendarViewMode {
  const urlView = new URLSearchParams(window.location.search).get("view");
  let storedView: string | null = null;
  try {
    storedView = window.localStorage.getItem(CALENDAR_VIEW_STORAGE_KEY);
  } catch {
    storedView = null;
  }
  return resolveCalendarView({ urlView, storedView });
}

function readCalendarViewSnapshot(): CalendarViewMode {
  return rememberedCalendarView ?? readInitialCalendarView();
}

function readCalendarViewServer(): typeof CALENDAR_VIEW_PENDING {
  return CALENDAR_VIEW_PENDING;
}

function DayPanel({
  selectedDate,
  today,
  jobs,
}: {
  selectedDate: string;
  today: string;
  jobs: Job[];
}) {
  return (
    <div
      id="calendar-day-panel"
      className="rounded-3xl border border-white/10 bg-white/[0.02] p-5 print:hidden"
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            {relativeDayLabel(selectedDate, today)}
          </p>
          <p className="text-sm font-semibold text-foreground">{formatLongDate(selectedDate)}</p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs text-slate-400">
          {jobs.length} job{jobs.length === 1 ? "" : "s"}
        </span>
      </div>

      {jobs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 px-5 py-8 text-center">
          <ListFilter className="mx-auto mb-2 h-5 w-5 text-slate-600" />
          <p className="text-sm text-muted">No jobs scheduled for this date.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {jobs.map((job) => {
            const heading = calendarJobHeading(job);
            const subtitle = calendarJobSubtitle(job);
            return (
              <li
                key={job.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] text-slate-500">{job.jobNumber}</p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {formatCalendarTimeRange(job, selectedDate)}
                    </p>
                    <p className="mt-0.5 whitespace-normal break-words text-sm font-medium text-foreground">
                      {heading}
                    </p>
                    {subtitle ? (
                      <p className="mt-0.5 whitespace-normal break-words text-xs text-muted">
                        {subtitle}
                      </p>
                    ) : null}
                    <p className="mt-0.5 whitespace-normal break-words text-xs text-muted">
                      {calendarTechLabel(job)}
                    </p>
                  </div>
                  <Link
                    href={ROUTE_BUILDERS.JOB_DETAIL(job.id)}
                    aria-label={`Open ${job.jobNumber}`}
                    className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-xs text-slate-400 transition-colors hover:text-white"
                  >
                    Open
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <StatusBadge
                    variant={
                      job.status === "Completed"
                        ? "success"
                        : job.status === "Scheduled"
                          ? "info"
                          : job.status === "In Progress"
                            ? "warning"
                            : "neutral"
                    }
                  >
                    {job.status}
                  </StatusBadge>
                  <StatusBadge
                    variant={
                      job.priority === "High"
                        ? "danger"
                        : job.priority === "Medium"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {job.priority}
                  </StatusBadge>
                  {isCalendarJobUnassigned(job) ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-yellow-500/20 bg-yellow-500/10 px-2 py-0.5 text-[10px] text-yellow-300">
                      <UserCircle2 className="h-3 w-3" />
                      Unassigned
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function CalendarScreen() {
  // Technicians only receive their own jobs. The jobs API uses the signed-in
  // session, and row security limits a tech to assigned work. This screen
  // does not widen that list.
  const { hydrated, jobs } = useJobs();
  const router = useRouter();
  const pathname = usePathname();

  const today = todayInCompanyTimeZone();
  const [year, setYear] = useState(() => Number(today.slice(0, 4)));
  const [month, setMonth] = useState(() => Number(today.slice(5, 7)) - 1);
  const [selectedDate, setSelectedDate] = useState(today);
  const viewSnapshot = useSyncExternalStore(
    subscribeCalendarView,
    readCalendarViewSnapshot,
    readCalendarViewServer,
  );
  const viewReady = viewSnapshot !== CALENDAR_VIEW_PENDING;
  const view: CalendarViewMode = viewReady ? viewSnapshot : "month";

  const jobsByDate = useMemo(() => groupJobsByDate(jobs), [jobs]);
  const visibleWeek = useMemo(() => weekDates(selectedDate), [selectedDate]);
  const dayJobs = jobsByDate[selectedDate] ?? [];
  const title =
    view === "week"
      ? formatWeekRangeLabel(visibleWeek[0], visibleWeek[6])
      : formatMonthTitle(year, month);

  const visibleHasToday =
    view === "week"
      ? visibleWeek.includes(today)
      : today.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`);
  const showToday = !visibleHasToday || selectedDate !== today;
  const hasUnscheduled = jobs.some((job) => !isJobScheduled(job));

  const focusDate = useCallback((date: string) => {
    setSelectedDate(date);
    const [y, m] = date.split("-").map(Number);
    setYear(y);
    setMonth(m - 1);
  }, []);

  const handleViewChange = useCallback(
    (next: CalendarViewMode) => {
      rememberedCalendarView = next;
      try {
        window.localStorage.setItem(CALENDAR_VIEW_STORAGE_KEY, next);
      } catch {
        // Private browsing can block storage. The address bar still remembers.
      }
      const params = new URLSearchParams(window.location.search);
      params.set("view", next);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      emitCalendarView();
      if (next === "week") {
        const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
        if (!selectedDate.startsWith(monthPrefix)) {
          focusDate(today.startsWith(monthPrefix) ? today : `${monthPrefix}-01`);
        }
      }
      if (next === "month") {
        const [y, m] = selectedDate.split("-").map(Number);
        setYear(y);
        setMonth(m - 1);
      }
    },
    [focusDate, month, pathname, router, selectedDate, today, year],
  );

  const handlePrev = useCallback(() => {
    if (view === "week") {
      focusDate(shiftDate(selectedDate, -7));
      return;
    }
    setMonth((current) => {
      if (current === 0) {
        setYear((value) => value - 1);
        return 11;
      }
      return current - 1;
    });
  }, [focusDate, selectedDate, view]);

  const handleNext = useCallback(() => {
    if (view === "week") {
      focusDate(shiftDate(selectedDate, 7));
      return;
    }
    setMonth((current) => {
      if (current === 11) {
        setYear((value) => value + 1);
        return 0;
      }
      return current + 1;
    });
  }, [focusDate, selectedDate, view]);

  const handleToday = useCallback(() => {
    focusDate(todayInCompanyTimeZone());
  }, [focusDate]);

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <PageHeader
          title="Calendar"
          description="Every scheduled job is listed on its day. Switch between month and week. Jobs without a date stay in Daily Plans."
        />
      </div>

      {!hydrated || !viewReady ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-sm text-slate-400">
          Loading calendar…
        </div>
      ) : (
        <div className="space-y-4">
          <CalendarGrid
            view={view}
            month={month}
            year={year}
            weekDates={visibleWeek}
            title={title}
            jobsByDate={jobsByDate}
            selectedDate={selectedDate}
            today={today}
            showToday={showToday}
            onSelectDate={setSelectedDate}
            onViewChange={handleViewChange}
            onPrev={handlePrev}
            onNext={handleNext}
            onToday={handleToday}
          />
          <DayPanel selectedDate={selectedDate} today={today} jobs={dayJobs} />
        </div>
      )}

      {hydrated && hasUnscheduled ? (
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 print:hidden">
          <CalendarRange className="h-4 w-4 shrink-0 text-slate-500" />
          <p className="text-xs text-slate-400">
            Jobs without a scheduled date are not plotted on the calendar. Manage them from{" "}
            <Link href={ROUTES.DAILY_PLANS} className="text-blue-400 hover:underline">
              Daily Plans → Unscheduled
            </Link>
            .
          </p>
        </div>
      ) : null}
    </div>
  );
}
