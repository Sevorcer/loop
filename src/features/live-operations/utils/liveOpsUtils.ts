// ============================================================
// Live Operations — pure derivation (rebuilt 2026-11-05)
//
// buildLiveOpsSnapshot() turns real rows into the Live view. It is pure
// ("now" is injected) so every Needs Attention rule is unit-tested.
// ============================================================

import {
  addCalendarDays,
  companyCalendarDate,
  companyTimeZone,
  zonedWallTimeToUtcIso,
} from "@/lib/timezone";

import {
  LIVE_OPS_THRESHOLD_MINUTES,
  type AttentionItem,
  type AttentionKind,
  type AttentionSeverity,
  type DayProgress,
  type FeedItem,
  type HealthState,
  type LiveJob,
  type LiveJobStage,
  type LiveOpsInput,
  type LiveOpsSnapshot,
  type LiveTimeOff,
  type TechCard,
  type TechJobRef,
  type TechState,
} from "../types/liveOps";

const MINUTE_MS = 60_000;
/** Assumed length of a job with a start time but no end time (overlap checks only). */
const DEFAULT_JOB_MINUTES = 60;
const FEED_LIMIT = 60;

const SEVERITY: Record<AttentionKind, AttentionSeverity> = {
  late_start: "critical",
  assigned_on_time_off: "critical",
  double_booked: "critical",
  running_long: "warning",
  stuck_in_progress: "warning",
  unassigned: "warning",
  on_hold: "warning",
};

/** Display order for Needs Attention (most urgent first). */
const KIND_ORDER: AttentionKind[] = [
  "late_start",
  "assigned_on_time_off",
  "double_booked",
  "running_long",
  "unassigned",
  "stuck_in_progress",
  "on_hold",
];

const ACTIVITY_LABELS: Record<string, string> = {
  file: "Photo or file added",
  note: "Note added",
  assigned: "Assignment changed",
  scheduled: "Schedule changed",
  created: "Job created",
  price: "Price updated",
  edited: "Job edited",
  qa: "QA checklist updated",
  contractor: "Contractor updated",
};

/** Status activity titles that are safe to show as-is (fixed strings written by Loop). */
const STATUS_TITLES = new Set([
  "Job started",
  "Job completed",
  "Status updated",
  "On the way",
  "Job deleted",
  "Job restored",
  "Customer notifications turned on",
  "Customer notifications turned off",
]);

// ------------------------------------------------------------------
// Small helpers
// ------------------------------------------------------------------

function ms(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const value = new Date(iso).getTime();
  return Number.isFinite(value) ? value : null;
}

function minutesBetween(fromMs: number, toMs: number): number {
  return Math.floor((toMs - fromMs) / MINUTE_MS);
}

export function formatClock(iso: string | null | undefined, timeZone = companyTimeZone()): string {
  const value = ms(iso);
  if (value === null) return "";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(value));
}

/** The time a job is expected to start: committed start, else the arrival window start. */
export function jobStartAt(job: LiveJob): string | null {
  return job.scheduledStartAt ?? job.arrivalWindowStartAt ?? null;
}

function jobInterval(job: LiveJob): { start: number; end: number } | null {
  const start = ms(jobStartAt(job));
  if (start === null) return null;
  const end = ms(job.scheduledEndAt ?? job.arrivalWindowEndAt);
  return { start, end: end !== null && end > start ? end : start + DEFAULT_JOB_MINUTES * MINUTE_MS };
}

function isOpen(job: LiveJob): boolean {
  return job.status !== "Completed" && job.status !== "Cancelled";
}

export function isScheduledToday(job: LiveJob, date: string): boolean {
  return job.scheduledFor === date;
}

/** Carried over: still In Progress but scheduled for an earlier day. */
export function isCarriedOver(job: LiveJob, date: string): boolean {
  return job.status === "In Progress" && !!job.scheduledFor && job.scheduledFor < date;
}

export function jobStage(job: LiveJob): LiveJobStage {
  switch (job.status) {
    case "Completed":
      return "completed";
    case "Cancelled":
      return "cancelled";
    case "On Hold":
      return "on_hold";
    case "In Progress":
      return "in_progress";
    default:
      return job.enRouteAt ? "on_the_way" : "scheduled";
  }
}

function overlaps(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
  return a.start < b.end && b.start < a.end;
}

export function companyDayBounds(date: string, timeZone = companyTimeZone()): { start: number; end: number } {
  const midnight = (isoDate: string) => {
    const [year, month, day] = isoDate.split("-").map(Number);
    return ms(zonedWallTimeToUtcIso({ year, month, day, hour: 0, minute: 0, timeZone })) ?? 0;
  };
  return { start: midnight(date), end: midnight(addCalendarDays(date, 1)) };
}

// ------------------------------------------------------------------
// Needs Attention rules (each exported for tests)
// ------------------------------------------------------------------

function item(
  kind: AttentionKind,
  job: LiveJob,
  title: string,
  detail: string,
  minutes: number | null,
  person?: { id: string; name: string },
): AttentionItem {
  return {
    id: `${kind}:${job.id}${person ? `:${person.id}` : ""}`,
    kind,
    severity: SEVERITY[kind],
    jobId: job.id,
    jobNumber: job.jobNumber,
    personId: person?.id ?? null,
    personName: person?.name ?? null,
    title,
    detail,
    minutes,
  };
}

/**
 * Late to start: scheduled today, still Scheduled, nobody tapped On The Way,
 * and the start time passed more than `threshold` minutes ago.
 */
export function findLateStarts(
  jobs: LiveJob[],
  date: string,
  nowMs: number,
  threshold = LIVE_OPS_THRESHOLD_MINUTES,
): AttentionItem[] {
  const out: AttentionItem[] = [];
  for (const job of jobs) {
    if (!isScheduledToday(job, date) || job.status !== "Scheduled" || job.enRouteAt) continue;
    const start = ms(jobStartAt(job));
    if (start === null) continue;
    const late = minutesBetween(start, nowMs);
    if (late >= threshold) {
      out.push(
        item(
          "late_start",
          job,
          "Late to start",
          `${late} min past the ${formatClock(jobStartAt(job))} start, nobody on the way`,
          late,
        ),
      );
    }
  }
  return out;
}

/**
 * Running long: scheduled today, In Progress, and more than `threshold`
 * minutes past its scheduled end. Carried-over jobs are reported as stuck instead.
 */
export function findRunningLong(
  jobs: LiveJob[],
  date: string,
  nowMs: number,
  threshold = LIVE_OPS_THRESHOLD_MINUTES,
): AttentionItem[] {
  const out: AttentionItem[] = [];
  for (const job of jobs) {
    if (!isScheduledToday(job, date) || job.status !== "In Progress") continue;
    const end = ms(job.scheduledEndAt);
    if (end === null) continue;
    const over = minutesBetween(end, nowMs);
    if (over >= threshold) {
      out.push(
        item(
          "running_long",
          job,
          "Running long",
          `${over} min past the ${formatClock(job.scheduledEndAt)} scheduled end`,
          over,
        ),
      );
    }
  }
  return out;
}

/** Stuck: In Progress but scheduled for an earlier day (never closed out). */
export function findStuckInProgress(jobs: LiveJob[], date: string): AttentionItem[] {
  return jobs
    .filter((job) => isCarriedOver(job, date))
    .map((job) =>
      item(
        "stuck_in_progress",
        job,
        "Still In Progress from an earlier day",
        `Scheduled ${job.scheduledFor}; close it out or move it to today`,
        null,
      ),
    );
}

/**
 * Double-booked: one person on two of today's open jobs whose times overlap.
 * A job with a start but no end is treated as one hour long.
 */
export function findDoubleBooked(jobs: LiveJob[], date: string): AttentionItem[] {
  const byPerson = new Map<string, { name: string; jobs: LiveJob[] }>();
  for (const job of jobs) {
    if (!isScheduledToday(job, date) || !isOpen(job)) continue;
    for (const person of job.assignees) {
      const entry = byPerson.get(person.id) ?? { name: person.name, jobs: [] };
      entry.jobs.push(job);
      byPerson.set(person.id, entry);
    }
  }
  const out: AttentionItem[] = [];
  for (const [personId, { name, jobs: personJobs }] of byPerson) {
    const timed = personJobs
      .map((job) => ({ job, interval: jobInterval(job) }))
      .filter((entry): entry is { job: LiveJob; interval: { start: number; end: number } } => !!entry.interval)
      .sort((a, b) => a.interval.start - b.interval.start);
    for (let i = 0; i < timed.length; i += 1) {
      for (let j = i + 1; j < timed.length; j += 1) {
        if (!overlaps(timed[i].interval, timed[j].interval)) continue;
        const first = timed[i].job;
        const second = timed[j].job;
        out.push({
          ...item(
            "double_booked",
            first,
            "Double-booked",
            `${name} is on ${first.jobNumber} and ${second.jobNumber} at the same time`,
            null,
            { id: personId, name },
          ),
          id: `double_booked:${first.id}:${second.id}:${personId}`,
        });
      }
    }
  }
  return out;
}

/** Assigned while on time off: the person's time off overlaps the open job's time (or the whole day if untimed). */
export function findAssignedOnTimeOff(
  jobs: LiveJob[],
  timeOff: LiveTimeOff[],
  date: string,
  timeZone = companyTimeZone(),
): AttentionItem[] {
  if (timeOff.length === 0) return [];
  const day = companyDayBounds(date, timeZone);
  const out: AttentionItem[] = [];
  for (const job of jobs) {
    if (!isScheduledToday(job, date) || !isOpen(job)) continue;
    const window = jobInterval(job) ?? day;
    for (const person of job.assignees) {
      const hit = timeOff.find((entry) => {
        if (entry.userId !== person.id) return false;
        const start = ms(entry.startsAt);
        const end = ms(entry.endsAt);
        if (start === null || end === null) return false;
        return overlaps(window, { start, end: Math.max(end, start + 1) });
      });
      if (hit) {
        out.push(
          item(
            "assigned_on_time_off",
            job,
            "Assigned while on time off",
            `${person.name} has time off during ${job.jobNumber}`,
            null,
            person,
          ),
        );
      }
    }
  }
  return out;
}

/** Unassigned: an open job scheduled today with nobody on it. */
export function findUnassigned(jobs: LiveJob[], date: string): AttentionItem[] {
  return jobs
    .filter((job) => isScheduledToday(job, date) && isOpen(job) && job.assignees.length === 0)
    .map((job) => item("unassigned", job, "Nobody assigned", "Scheduled today with no tech on it", null));
}

/** On Hold today. */
export function findOnHoldToday(jobs: LiveJob[], date: string): AttentionItem[] {
  return jobs
    .filter((job) => isScheduledToday(job, date) && job.status === "On Hold")
    .map((job) => item("on_hold", job, "On Hold", "Scheduled today but on hold", null));
}

export function deriveAttention(input: LiveOpsInput, timeZone = companyTimeZone()): AttentionItem[] {
  const nowMs = ms(input.now) ?? Date.now();
  const all = [
    ...findLateStarts(input.jobs, input.date, nowMs),
    ...findAssignedOnTimeOff(input.jobs, input.timeOff, input.date, timeZone),
    ...findDoubleBooked(input.jobs, input.date),
    ...findRunningLong(input.jobs, input.date, nowMs),
    ...findUnassigned(input.jobs, input.date),
    ...findStuckInProgress(input.jobs, input.date),
    ...findOnHoldToday(input.jobs, input.date),
  ];
  return all.sort((a, b) => {
    const kind = KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind);
    if (kind !== 0) return kind;
    return (b.minutes ?? 0) - (a.minutes ?? 0);
  });
}

export function deriveHealth(attention: AttentionItem[]): { state: HealthState; label: string } {
  const critical = attention.filter((entry) => entry.severity === "critical").length;
  if (critical >= 2) return { state: "critical", label: "Critical" };
  if (critical === 1) return { state: "needs_attention", label: "Needs attention" };
  if (attention.length > 0) return { state: "minor_issues", label: "Minor issues" };
  return { state: "healthy", label: "On track" };
}

// ------------------------------------------------------------------
// Day progress, tech board, feed
// ------------------------------------------------------------------

export function deriveProgress(jobs: LiveJob[], date: string): DayProgress {
  const progress: DayProgress = { total: 0, scheduled: 0, onTheWay: 0, inProgress: 0, completed: 0, onHold: 0 };
  for (const job of jobs) {
    if (!isScheduledToday(job, date)) continue;
    const stage = jobStage(job);
    if (stage === "cancelled") continue;
    progress.total += 1;
    if (stage === "scheduled") progress.scheduled += 1;
    else if (stage === "on_the_way") progress.onTheWay += 1;
    else if (stage === "in_progress") progress.inProgress += 1;
    else if (stage === "completed") progress.completed += 1;
    else if (stage === "on_hold") progress.onHold += 1;
  }
  return progress;
}

function startedAtByJob(input: LiveOpsInput): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of input.activity) {
    if (row.type !== "status" || row.title !== "Job started") continue;
    const previous = map.get(row.jobId);
    if (!previous || row.createdAt > previous) map.set(row.jobId, row.createdAt);
  }
  return map;
}

function sortByStart(a: LiveJob, b: LiveJob): number {
  const left = ms(jobStartAt(a)) ?? Number.POSITIVE_INFINITY;
  const right = ms(jobStartAt(b)) ?? Number.POSITIVE_INFINITY;
  if (left !== right) return left - right;
  return a.jobNumber.localeCompare(b.jobNumber);
}

function isOffNow(personId: string, timeOff: LiveTimeOff[], nowMs: number): boolean {
  return timeOff.some((entry) => {
    if (entry.userId !== personId) return false;
    const start = ms(entry.startsAt);
    const end = ms(entry.endsAt);
    return start !== null && end !== null && start <= nowMs && nowMs < end;
  });
}

export function deriveTechCards(
  input: LiveOpsInput,
  attention: AttentionItem[],
): TechCard[] {
  const nowMs = ms(input.now) ?? Date.now();
  const startedAt = startedAtByJob(input);
  const names = new Map(input.people.map((person) => [person.id, person.name]));

  // Who appears: anyone with the tech role, anyone assigned to a relevant job,
  // and anyone with time off today.
  const ids = new Set<string>();
  for (const person of input.people) if (person.role === "tech") ids.add(person.id);
  for (const job of input.jobs) for (const person of job.assignees) {
    ids.add(person.id);
    if (!names.has(person.id)) names.set(person.id, person.name);
  }
  for (const entry of input.timeOff) ids.add(entry.userId);

  const ref = (job: LiveJob, at: string | null): TechJobRef => ({
    id: job.id,
    jobNumber: job.jobNumber,
    customerName: job.customerName,
    at,
  });

  const cards: TechCard[] = [];
  for (const personId of ids) {
    const mine = input.jobs.filter(
      (job) => job.status !== "Cancelled" && job.assignees.some((person) => person.id === personId),
    );
    const today = mine.filter((job) => isScheduledToday(job, input.date)).sort(sortByStart);
    const inProgress = mine.filter((job) => job.status === "In Progress").sort(sortByStart);
    const onTheWay = today.filter((job) => jobStage(job) === "on_the_way");
    const remaining = today.filter((job) => job.status === "Scheduled");
    const done = today.filter((job) => job.status === "Completed");
    const offNow = isOffNow(personId, input.timeOff, nowMs);
    const onTimeOff = offNow || input.timeOff.some((entry) => entry.userId === personId);

    // Prefer a job started today over a carried-over one for "current".
    const current =
      inProgress.find((job) => isScheduledToday(job, input.date)) ?? inProgress[0] ?? onTheWay[0] ?? null;
    const next = remaining.find((job) => job.id !== current?.id) ?? null;

    let state: TechState;
    if (current && current.status === "In Progress") state = "on_job";
    else if (current) state = "on_the_way";
    else if (offNow) state = "off_today";
    else if (today.length === 0) state = onTimeOff ? "off_today" : "free";
    else if (remaining.length === 0) state = "done";
    else if (done.length > 0) state = "between_jobs";
    else state = "not_started";

    const currentAt = current
      ? current.status === "In Progress"
        ? startedAt.get(current.id) ?? null
        : current.enRouteAt
      : null;

    const kinds = new Set<AttentionKind>();
    const myJobIds = new Set(mine.map((job) => job.id));
    for (const entry of attention) {
      if (entry.personId === personId || (entry.personId === null && myJobIds.has(entry.jobId))) {
        kinds.add(entry.kind);
      }
    }

    cards.push({
      personId,
      name: names.get(personId) ?? "Team member",
      state,
      currentJob: current ? ref(current, currentAt) : null,
      nextJob: next ? ref(next, jobStartAt(next)) : null,
      jobsToday: today.length,
      jobsDone: done.length,
      onTimeOff,
      attentionKinds: KIND_ORDER.filter((kind) => kinds.has(kind)),
    });
  }

  const STATE_ORDER: TechState[] = [
    "on_job",
    "on_the_way",
    "between_jobs",
    "not_started",
    "done",
    "free",
    "off_today",
  ];
  return cards.sort((a, b) => {
    const left = (a.attentionKinds.length > 0 ? -10 : 0) + STATE_ORDER.indexOf(a.state);
    const right = (b.attentionKinds.length > 0 ? -10 : 0) + STATE_ORDER.indexOf(b.state);
    if (left !== right) return left - right;
    return a.name.localeCompare(b.name);
  });
}

export function deriveFeed(input: LiveOpsInput, timeZone = companyTimeZone()): FeedItem[] {
  const jobNumbers = new Map(input.jobs.map((job) => [job.id, job.jobNumber]));
  const names = new Map(input.people.map((person) => [person.id, person.name]));
  const isToday = (iso: string) => companyCalendarDate(iso, timeZone) === input.date;

  const items: FeedItem[] = [];
  for (const row of input.activity) {
    if (!isToday(row.createdAt) || !jobNumbers.has(row.jobId)) continue;
    const label =
      row.type === "status"
        ? STATUS_TITLES.has(row.title)
          ? row.title
          : "Status updated"
        : ACTIVITY_LABELS[row.type] ?? "Job updated";
    // A note written through the notes panel shows up from job_notes below.
    if (row.type === "note") continue;
    items.push({
      id: `activity:${row.id}`,
      at: row.createdAt,
      jobId: row.jobId,
      jobNumber: jobNumbers.get(row.jobId) ?? "",
      label,
      actorName: row.actorId ? names.get(row.actorId) ?? null : null,
    });
  }
  for (const note of input.notes) {
    if (!isToday(note.createdAt) || !jobNumbers.has(note.jobId)) continue;
    items.push({
      id: `note:${note.id}`,
      at: note.createdAt,
      jobId: note.jobId,
      jobNumber: jobNumbers.get(note.jobId) ?? "",
      label: "Note added",
      actorName: note.authorId ? names.get(note.authorId) ?? null : null,
    });
  }
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, FEED_LIMIT);
}

// ------------------------------------------------------------------
// Snapshot
// ------------------------------------------------------------------

export function buildLiveOpsSnapshot(input: LiveOpsInput, timeZone = companyTimeZone()): LiveOpsSnapshot {
  const attention = deriveAttention(input, timeZone);
  const health = deriveHealth(attention);
  const techs = deriveTechCards(input, attention);
  const progress = deriveProgress(input.jobs, input.date);
  const feed = deriveFeed(input, timeZone);

  const todayJobs = input.jobs
    .filter((job) => isScheduledToday(job, input.date) && job.status !== "Cancelled")
    .sort(sortByStart)
    .map((job) => job.job);
  const inProgressJobs = input.jobs
    .filter((job) => job.status === "In Progress")
    .sort(sortByStart)
    .map((job) => job.job);

  const lastActivityAt = feed[0]?.at ?? null;

  return {
    date: input.date,
    generatedAt: input.now,
    dayStartedAt: input.dayStartedAt,
    thresholdMinutes: LIVE_OPS_THRESHOLD_MINUTES,
    hero: {
      techsWorking: techs.filter((card) => card.state === "on_job").length,
      techsOnTheWay: techs.filter((card) => card.state === "on_the_way").length,
      jobsRunning: inProgressJobs.length,
      lateOrLong: attention.filter((entry) => entry.kind === "late_start" || entry.kind === "running_long").length,
      attentionCount: attention.length,
      criticalCount: attention.filter((entry) => entry.severity === "critical").length,
      health: health.state,
      healthLabel: health.label,
      lastActivityAt,
    },
    techs,
    attention,
    progress,
    feed,
    todayJobs,
    inProgressJobs,
  };
}

