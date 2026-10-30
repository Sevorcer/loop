"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, CalendarRange, ListFilter, UserCircle2 } from "lucide-react";

import { PageHeader, StatusBadge } from "@/components/atlas";
import { useCurrentRole } from "@/features/auth";
import { useJobs } from "@/features/jobs/state/JobsProvider";
import type { Job } from "@/features/jobs/types/job";
import { ApiRequestError, requestJson } from "@/lib/api/client";
import { todayInCompanyTimeZone } from "@/lib/timezone";
import { ROUTE_BUILDERS, ROUTES } from "@/lib/routes";

import { CalendarEntryDialog, type CalendarEditor } from "../components/CalendarEntryDialog";
import { CalendarGrid } from "../components/CalendarGrid";
import { CalendarPeopleFilter } from "../components/CalendarPeopleFilter";
import {
  canManageCalendarEntries,
  type CalendarPerson,
  type CalendarTaskEntry,
  type TimeOffEntry,
} from "../types/calendarEntries";
import { groupCalendarBoard } from "../utils/calendarEntries";
import {
  CALENDAR_PEOPLE_GROUPS_KEY,
  CALENDAR_PEOPLE_STORAGE_KEY,
  filterCalendarByPeople,
  parseStoredPersonIds,
  parseStoredQuickGroups,
  type CalendarQuickGroup,
} from "../utils/calendarPeopleFilter";
import {
  clearLocalCalendarGroups,
  mergeCalendarGroups,
  readLocalCalendarGroups,
  releaseGroupImport,
  takeGroupsToImport,
} from "../utils/calendarGroupSync";
import {
  CALENDAR_VIEW_STORAGE_KEY,
  calendarJobHeading,
  calendarJobSubtitle,
  calendarTechLabel,
  formatCalendarTimeRange,
  formatLongDate,
  formatMonthTitle,
  formatWeekRangeLabel,
  isCalendarJobUnassigned,
  isJobScheduled,
  relativeDayLabel,
  resolveCalendarView,
  shiftDate,
  weekDates,
  type CalendarViewMode,
} from "../utils/calendarSchedule";

const CALENDAR_VIEW_PENDING = "pending" as const;
const CALENDAR_PEOPLE_PENDING = "pending" as const;

const calendarPeopleListeners = new Set<() => void>();
let rememberedPeople: string[] | null = null;
let rememberedGroups: CalendarQuickGroup[] | null = null;

// useSyncExternalStore compares snapshots with Object.is. Parsing storage on
// every read returned a new array and retriggered render forever (React #185).
const EMPTY_PEOPLE: string[] = [];
const EMPTY_GROUPS: CalendarQuickGroup[] = [];
let cachedPeopleRaw: string | null | undefined;
let cachedPeople: string[] = EMPTY_PEOPLE;
let cachedGroupsRaw: string | null | undefined;
let cachedGroups: CalendarQuickGroup[] = EMPTY_GROUPS;

function subscribeCalendarPeople(listener: () => void) {
  calendarPeopleListeners.add(listener);
  return () => {
    calendarPeopleListeners.delete(listener);
  };
}

function emitCalendarPeople() {
  for (const listener of calendarPeopleListeners) listener();
}

type StoredPeople = string[] | typeof CALENDAR_PEOPLE_PENDING;
type StoredGroups = CalendarQuickGroup[] | typeof CALENDAR_PEOPLE_PENDING;

export function readStoredPeople(): StoredPeople {
  if (rememberedPeople) return rememberedPeople;
  try {
    const raw = window.localStorage.getItem(CALENDAR_PEOPLE_STORAGE_KEY);
    if (raw !== cachedPeopleRaw) {
      cachedPeopleRaw = raw;
      const parsed = parseStoredPersonIds(raw);
      cachedPeople = parsed.length ? parsed : EMPTY_PEOPLE;
    }
    return cachedPeople;
  } catch {
    return EMPTY_PEOPLE;
  }
}

export function readStoredGroups(): StoredGroups {
  if (rememberedGroups) return rememberedGroups;
  try {
    const raw = window.localStorage.getItem(CALENDAR_PEOPLE_GROUPS_KEY);
    if (raw !== cachedGroupsRaw) {
      cachedGroupsRaw = raw;
      const parsed = parseStoredQuickGroups(raw);
      cachedGroups = parsed.length ? parsed : EMPTY_GROUPS;
    }
    return cachedGroups;
  } catch {
    return EMPTY_GROUPS;
  }
}

export function readPeopleServer(): StoredPeople {
  return CALENDAR_PEOPLE_PENDING;
}

export function readGroupsServer(): StoredGroups {
  return CALENDAR_PEOPLE_PENDING;
}

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

export function readCalendarViewSnapshot(): CalendarViewMode {
  return rememberedCalendarView ?? readInitialCalendarView();
}

export function readCalendarViewServer(): typeof CALENDAR_VIEW_PENDING {
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
      className="hidden rounded-3xl border border-white/10 bg-white/[0.02] p-5 md:block print:hidden"
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
  const { role } = useCurrentRole();
  const router = useRouter();
  const pathname = usePathname();
  const office = canManageCalendarEntries(role);
  const [timeOff, setTimeOff] = useState<TimeOffEntry[]>([]);
  const [tasks, setTasks] = useState<CalendarTaskEntry[]>([]);
  const [team, setTeam] = useState<CalendarPerson[]>([]);
  const [editor, setEditor] = useState<CalendarEditor | null>(null);
  const [entriesNote, setEntriesNote] = useState<string | null>(null);

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
  const peopleSnapshot = useSyncExternalStore(
    subscribeCalendarPeople,
    readStoredPeople,
    readPeopleServer,
  );
  const peopleReady = peopleSnapshot !== CALENDAR_PEOPLE_PENDING;
  const selectedPeople = useMemo(
    () => (peopleSnapshot === CALENDAR_PEOPLE_PENDING ? [] : peopleSnapshot),
    [peopleSnapshot],
  );
  const [savedGroups, setSavedGroups] = useState<CalendarQuickGroup[]>([]);
  const [groupsReady, setGroupsReady] = useState(false);
  const [groupError, setGroupError] = useState<string | null>(null);

  const directory = useMemo(() => {
    const byId = new Map<string, string>();
    for (const person of team) byId.set(person.id, person.name);
    for (const job of jobs) {
      for (const assignee of job.assignees ?? []) {
        if (assignee.id && assignee.name.trim()) byId.set(assignee.id, assignee.name.trim());
      }
    }
    for (const entry of timeOff) {
      if (entry.userId && entry.personName.trim()) byId.set(entry.userId, entry.personName.trim());
    }
    return [...byId.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((left, right) => left.name.localeCompare(right.name, "en", { sensitivity: "base" }));
  }, [jobs, team, timeOff]);

  const filtered = useMemo(
    () =>
      office
        ? filterCalendarByPeople({
            jobs,
            timeOff,
            tasks,
            selectedIds: selectedPeople,
            people: directory,
          })
        : { jobs, timeOff, tasks },
    [directory, jobs, office, selectedPeople, tasks, timeOff],
  );

  const itemsByDate = useMemo(
    () => groupCalendarBoard(filtered),
    [filtered],
  );
  const visibleWeek = useMemo(() => weekDates(selectedDate), [selectedDate]);
  const dayItems = itemsByDate[selectedDate] ?? [];
  const dayJobs = dayItems.flatMap((item) => (item.kind === "job" && item.job ? [item.job] : []));

  const rememberPeople = useCallback((personIds: string[]) => {
    rememberedPeople = personIds;
    try {
      window.localStorage.setItem(CALENDAR_PEOPLE_STORAGE_KEY, JSON.stringify(personIds));
    } catch {
      // Private browsing can block storage. The choice still lasts for this visit.
    }
    emitCalendarPeople();
  }, []);

  const rememberGroups = useCallback((groups: CalendarQuickGroup[]) => {
    rememberedGroups = groups;
    try {
      window.localStorage.setItem(CALENDAR_PEOPLE_GROUPS_KEY, JSON.stringify(groups));
    } catch {
      // The group list still updates for this visit.
    }
    emitCalendarPeople();
  }, []);

  useEffect(() => {
    if (!office || !role) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await requestJson<{ groups?: CalendarQuickGroup[] }>("/api/calendar/groups", {
          role,
          cache: "no-store",
        });
        const remote = Array.isArray(data.groups) ? data.groups : [];
        const pending = takeGroupsToImport(readLocalCalendarGroups(), remote);
        const created: CalendarQuickGroup[] = [];
        let failed = false;
        for (const group of pending) {
          try {
            const saved = await requestJson<{ group?: CalendarQuickGroup }>("/api/calendar/groups", {
              method: "POST",
              role,
              cache: "no-store",
              body: { name: group.name, personIds: group.personIds },
            });
            if (saved.group?.id && saved.group.name) {
              created.push(saved.group);
            } else {
              failed = true;
              releaseGroupImport(group);
            }
          } catch {
            failed = true;
            releaseGroupImport(group);
          }
        }
        if (!failed) {
          rememberedGroups = null;
          cachedGroupsRaw = undefined;
          clearLocalCalendarGroups();
          emitCalendarPeople();
        }
        if (cancelled) return;
        setSavedGroups(
          mergeCalendarGroups([...remote, ...created, ...(failed ? readLocalCalendarGroups() : [])]),
        );
        setGroupError(
          failed ? "A saved group could not be shared yet. It is still in this browser." : null,
        );
      } catch (error) {
        if (cancelled) return;
        setSavedGroups(readLocalCalendarGroups());
        if (!(error instanceof ApiRequestError) || (error.status !== 401 && error.status !== 403)) {
          setGroupError("Shared groups could not be loaded. Showing groups saved in this browser.");
        }
      } finally {
        if (!cancelled) setGroupsReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [office, role]);

  const persistGroup = useCallback(
    async (name: string, personIds: string[], groupId?: string) => {
      if (!role) return;
      const existing = groupId
        ? savedGroups.find((group) => group.id === groupId)
        : savedGroups.find((group) => group.name.trim().toLowerCase() === name.trim().toLowerCase());
      try {
        const saved = await requestJson<{ group: CalendarQuickGroup }>(
          existing ? `/api/calendar/groups/${existing.id}` : "/api/calendar/groups",
          {
            method: existing ? "PATCH" : "POST",
            role,
            body: { name, personIds },
          },
        );
        setSavedGroups((current) =>
          mergeCalendarGroups([
            ...current.filter((group) => group.id !== saved.group.id),
            saved.group,
          ]),
        );
        setGroupError(null);
      } catch (error) {
        if (error instanceof ApiRequestError && error.status === 503) {
          const fallback: CalendarQuickGroup = {
            id: existing?.id ?? `${Date.now()}`,
            name,
            personIds,
          };
          const next = mergeCalendarGroups([
            ...savedGroups.filter((group) => group.id !== fallback.id),
            fallback,
          ]);
          rememberGroups(next);
          setSavedGroups(next);
        }
        setGroupError(error instanceof Error ? error.message : "The group could not be saved.");
      }
    },
    [rememberGroups, role, savedGroups],
  );

  const removeGroup = useCallback(
    async (groupId: string) => {
      if (!role) return;
      try {
        await requestJson(`/api/calendar/groups/${groupId}`, { method: "DELETE", role });
        setSavedGroups((current) => current.filter((group) => group.id !== groupId));
        setGroupError(null);
      } catch (error) {
        setGroupError(error instanceof Error ? error.message : "The group could not be removed.");
      }
    },
    [role],
  );

  const reloadEntries = useCallback(async () => {
    if (!role) return;
    try {
      const data = await requestJson<{ timeOff: TimeOffEntry[]; tasks: CalendarTaskEntry[] }>(
        "/api/calendar",
        { role, cache: "no-store" },
      );
      setTimeOff(data.timeOff);
      setTasks(data.tasks);
      setEntriesNote(null);
    } catch (error) {
      if (error instanceof ApiRequestError && (error.status === 401 || error.status === 403)) {
        setTimeOff([]);
        setTasks([]);
        return;
      }
      setEntriesNote("Time off and tasks could not be loaded. Scheduled jobs are still shown.");
    }
  }, [role]);

  useEffect(() => {
    if (!role) return;
    let cancelled = false;
    void requestJson<{ timeOff: TimeOffEntry[]; tasks: CalendarTaskEntry[] }>("/api/calendar", {
      role,
      cache: "no-store",
    })
      .then((data) => {
        if (cancelled) return;
        setTimeOff(data.timeOff);
        setTasks(data.tasks);
        setEntriesNote(null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiRequestError && (error.status === 401 || error.status === 403)) {
          setTimeOff([]);
          setTasks([]);
          return;
        }
        setEntriesNote("Time off and tasks could not be loaded. Scheduled jobs are still shown.");
      });
    return () => {
      cancelled = true;
    };
  }, [role]);

  useEffect(() => {
    if (!office) return;
    let cancelled = false;
    void requestJson<{ team: CalendarPerson[] }>("/api/calendar/team", { role, cache: "no-store" })
      .then((data) => {
        if (!cancelled) setTeam(data.team);
      })
      .catch(() => {
        if (!cancelled) setTeam([]);
      });
    return () => {
      cancelled = true;
    };
  }, [office, role]);
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
    <div className="min-w-0 space-y-6">
      <div className="print:hidden">
        <PageHeader
          title="Calendar"
          description="Every scheduled job, time off, and task is listed on its day. Switch between month and week, or show one person's work."
        />
      </div>

      {!hydrated || !viewReady || !peopleReady || (office && role && !groupsReady) ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-sm text-slate-400">
          Loading calendar…
        </div>
      ) : (
        <div className="space-y-4">
          {office ? (
            <CalendarPeopleFilter
              people={directory}
              selectedIds={selectedPeople}
              groups={savedGroups}
              onChange={rememberPeople}
              onApplyGroup={rememberPeople}
              onSaveGroup={(name, personIds, groupId) => {
                void persistGroup(name, personIds, groupId);
              }}
              onDeleteGroup={(groupId) => {
                void removeGroup(groupId);
              }}
            />
          ) : null}
          {office && groupError ? <p className="text-sm text-muted">{groupError}</p> : null}
          <CalendarGrid
            view={view}
            month={month}
            year={year}
            weekDates={visibleWeek}
            title={title}
            itemsByDate={itemsByDate}
            selectedDate={selectedDate}
            today={today}
            showToday={showToday}
            onSelectDate={setSelectedDate}
            onViewChange={handleViewChange}
            onPrev={handlePrev}
            onNext={handleNext}
            onToday={handleToday}
            onAdd={office ? () => setEditor({ mode: "choose", date: selectedDate }) : undefined}
            onOpenTimeOff={(entry) => setEditor({ mode: "time_off", date: selectedDate, entry })}
            onOpenTask={(entry) => setEditor({ mode: "task", date: selectedDate, entry })}
          />
          {entriesNote ? <p className="text-sm text-muted">{entriesNote}</p> : null}
          <DayPanel selectedDate={selectedDate} today={today} jobs={dayJobs} />
          {editor ? (
            <CalendarEntryDialog
              editor={editor}
              role={role}
              team={team}
              onClose={() => setEditor(null)}
              onPickKind={(kind, date) => setEditor({ mode: kind, date })}
              onSaved={() => {
                setEditor(null);
                void reloadEntries();
              }}
            />
          ) : null}
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
