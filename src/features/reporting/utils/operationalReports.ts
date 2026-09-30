/**
 * Operational reports (P3) — pure computation for the four reports Collin asked for:
 * monthly install report, pipeline view, tech scorecards, callback/rework tracking.
 *
 * All functions are pure: they take job rows + status-activity rows and a
 * "YYYY-MM" month key, and return plain report objects. No I/O, no framework.
 */

export interface ReportJobRow {
  id: string;
  jobNumber: string;
  type: string;
  status: string;
  title: string;
  customerName: string;
  propertyName: string;
  assignedTo: string;
  scheduledStartAt: string | null;
  scheduledFor: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportStatusActivity {
  jobId: string;
  title: string;
  createdAt: string;
}

/** "YYYY-MM" */
export type MonthKey = string;

const OPEN_STATUSES = new Set(["Scheduled", "In Progress", "On Hold"]);
const COMPLETED_TITLE = "Job completed";

/** "2026-09-29T14:00:00+00:00" -> "2026-09-29"; "2026-09-29" -> "2026-09-29". */
export function toDatePart(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
  return match ? match[1] : null;
}

export function monthOfDate(datePart: string | null): MonthKey | null {
  return datePart ? datePart.slice(0, 7) : null;
}

/** Committed scheduled date for a job (real timestamp first, legacy date fallback). */
export function scheduledDateOf(job: ReportJobRow): string | null {
  return toDatePart(job.scheduledStartAt) ?? toDatePart(job.scheduledFor);
}

/**
 * The month a job belongs to for reporting: scheduled month when scheduled,
 * otherwise the month it was created.
 */
export function reportMonthOf(job: ReportJobRow): MonthKey | null {
  return (
    monthOfDate(scheduledDateOf(job)) ?? monthOfDate(toDatePart(job.createdAt))
  );
}

export function techNameOf(job: ReportJobRow): string {
  const name = job.assignedTo.trim();
  return name === "" ? "Unassigned" : name;
}

export interface JobTiming {
  /** Date the job reached Completed ("Job completed" activity), or null if unknown. */
  completedDate: string | null;
  /**
   * Date of the latest status change. Falls back to updated_at when the job is
   * in a terminal status but has no status activity (e.g. legacy rows).
   */
  terminalDate: string | null;
}

/** Derives per-job completion / terminal dates from the status-activity log. */
export function buildJobTiming(
  jobs: ReportJobRow[],
  activities: ReportStatusActivity[],
): Map<string, JobTiming> {
  const latestActivity = new Map<string, string>();
  const completedAt = new Map<string, string>();

  for (const activity of activities) {
    const date = toDatePart(activity.createdAt);
    if (!date) continue;
    const prev = latestActivity.get(activity.jobId);
    if (!prev || date >= prev) latestActivity.set(activity.jobId, date);
    if (activity.title === COMPLETED_TITLE) {
      const prevCompleted = completedAt.get(activity.jobId);
      if (!prevCompleted || date >= prevCompleted) completedAt.set(activity.jobId, date);
    }
  }

  const timing = new Map<string, JobTiming>();
  for (const job of jobs) {
    const completedDate = completedAt.get(job.id) ?? null;
    let terminalDate = latestActivity.get(job.id) ?? null;
    if (
      !terminalDate &&
      (job.status === "Completed" || job.status === "Cancelled")
    ) {
      terminalDate = toDatePart(job.updatedAt);
    }
    timing.set(job.id, { completedDate, terminalDate });
  }
  return timing;
}

export function monthLabel(month: MonthKey): string {
  const date = new Date(`${month}-01T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return month;
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function isValidMonth(month: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}

export function currentMonthKey(now = new Date()): MonthKey {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

// ─── 1. Monthly install report ───────────────────────────────────────────────

export interface InstallJobRow {
  id: string;
  jobNumber: string;
  title: string;
  customerName: string;
  tech: string;
  date: string | null;
  status: string;
}

export interface InstallWeekBucket {
  index: number;
  label: string;
  count: number;
}

export interface InstallReport {
  month: MonthKey;
  total: number;
  unscheduled: number;
  byWeek: InstallWeekBucket[];
  byTech: Array<{ tech: string; count: number }>;
  jobs: InstallJobRow[];
}

export function computeInstallReport(
  jobs: ReportJobRow[],
  month: MonthKey,
): InstallReport {
  const installs = jobs.filter((job) => job.type === "Install");
  const inMonth = installs.filter((job) => reportMonthOf(job) === month);

  const weekCounts = new Map<number, number>();
  const techCounts = new Map<string, number>();
  let unscheduled = 0;
  const rows: InstallJobRow[] = [];

  for (const job of inMonth) {
    const date = scheduledDateOf(job);
    if (date && monthOfDate(date) === month) {
      const day = Number(date.slice(8, 10));
      const weekIndex = Math.min(5, Math.ceil(day / 7));
      weekCounts.set(weekIndex, (weekCounts.get(weekIndex) ?? 0) + 1);
    } else {
      unscheduled += 1;
    }
    const tech = techNameOf(job);
    techCounts.set(tech, (techCounts.get(tech) ?? 0) + 1);
    rows.push({
      id: job.id,
      jobNumber: job.jobNumber,
      title: job.title,
      customerName: job.customerName,
      tech,
      date,
      status: job.status,
    });
  }

  rows.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));

  const monthShort = new Date(`${month}-01T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
  const daysInMonth = new Date(
    Number(month.slice(0, 4)),
    Number(month.slice(5, 7)),
    0,
  ).getDate();
  const byWeek: InstallWeekBucket[] = [];
  for (let index = 1; index <= Math.ceil(daysInMonth / 7); index++) {
    const start = (index - 1) * 7 + 1;
    const end = Math.min(index * 7, daysInMonth);
    byWeek.push({
      index,
      label: `${monthShort} ${start}–${end}`,
      count: weekCounts.get(index) ?? 0,
    });
  }

  const byTech = [...techCounts.entries()]
    .map(([tech, count]) => ({ tech, count }))
    .sort((a, b) => b.count - a.count || a.tech.localeCompare(b.tech));

  return { month, total: inMonth.length, unscheduled, byWeek, byTech, jobs: rows };
}

// ─── 2. Pipeline view ────────────────────────────────────────────────────────

export interface PipelineEstimateRow {
  id: string;
  jobNumber: string;
  title: string;
  customerName: string;
  status: string;
  tech: string;
}

export interface PipelineReport {
  openEstimates: number;
  openEstimatesByStatus: Array<{ status: string; count: number }>;
  scheduledJobs: number;
  completedInMonth: number;
  estimatesWon: number;
  estimatesLost: number;
  /** Won / (won + lost) for estimates closed in the month; null when none closed. */
  closeRate: number | null;
  openEstimatesList: PipelineEstimateRow[];
}

export function computePipelineReport(
  jobs: ReportJobRow[],
  timing: Map<string, JobTiming>,
  month: MonthKey,
): PipelineReport {
  const estimates = jobs.filter((job) => job.type === "Estimate");
  const openEstimates = estimates.filter((job) => OPEN_STATUSES.has(job.status));

  const byStatus = new Map<string, number>();
  for (const job of openEstimates) {
    byStatus.set(job.status, (byStatus.get(job.status) ?? 0) + 1);
  }
  const openEstimatesByStatus = [...byStatus.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  const scheduledJobs = jobs.filter(
    (job) =>
      job.type !== "Estimate" && job.type !== "Callback" && OPEN_STATUSES.has(job.status),
  ).length;

  let completedInMonth = 0;
  for (const job of jobs) {
    if (job.type === "Estimate") continue;
    const completedDate = timing.get(job.id)?.completedDate ?? null;
    if (completedDate && monthOfDate(completedDate) === month) completedInMonth += 1;
  }

  let estimatesWon = 0;
  let estimatesLost = 0;
  for (const job of estimates) {
    if (job.status !== "Completed" && job.status !== "Cancelled") continue;
    const terminalDate = timing.get(job.id)?.terminalDate ?? null;
    if (!terminalDate || monthOfDate(terminalDate) !== month) continue;
    if (job.status === "Completed") estimatesWon += 1;
    else estimatesLost += 1;
  }

  const closed = estimatesWon + estimatesLost;
  const closeRate = closed > 0 ? estimatesWon / closed : null;

  const openEstimatesList: PipelineEstimateRow[] = openEstimates.map((job) => ({
    id: job.id,
    jobNumber: job.jobNumber,
    title: job.title,
    customerName: job.customerName,
    status: job.status,
    tech: techNameOf(job),
  }));

  return {
    openEstimates: openEstimates.length,
    openEstimatesByStatus,
    scheduledJobs,
    completedInMonth,
    estimatesWon,
    estimatesLost,
    closeRate,
    openEstimatesList,
  };
}

// ─── 3. Tech scorecards ──────────────────────────────────────────────────────

export interface TechScorecard {
  tech: string;
  /** Non-estimate jobs completed in the month. */
  jobsDone: number;
  /** % of timed completions finished on or before the scheduled date. */
  onTimePct: number | null;
  timedCompletions: number;
  /** Callback jobs in the month. */
  callbacks: number;
  /** Callbacks / jobs done; null when no completions. */
  callbackRate: number | null;
  /** Currently open (booked) non-estimate jobs. */
  booked: number;
}

export function computeTechScorecards(
  jobs: ReportJobRow[],
  timing: Map<string, JobTiming>,
  month: MonthKey,
): TechScorecard[] {
  interface Acc {
    jobsDone: number;
    onTime: number;
    timed: number;
    callbacks: number;
    booked: number;
  }
  const acc = new Map<string, Acc>();
  const get = (tech: string): Acc => {
    let a = acc.get(tech);
    if (!a) {
      a = { jobsDone: 0, onTime: 0, timed: 0, callbacks: 0, booked: 0 };
      acc.set(tech, a);
    }
    return a;
  };

  for (const job of jobs) {
    const tech = techNameOf(job);
    const t = timing.get(job.id);
    const completedDate = t?.completedDate ?? null;

    if (
      job.type !== "Estimate" &&
      completedDate &&
      monthOfDate(completedDate) === month
    ) {
      const a = get(tech);
      a.jobsDone += 1;
      const scheduled = scheduledDateOf(job);
      if (scheduled) {
        a.timed += 1;
        if (completedDate <= scheduled) a.onTime += 1;
      }
    }

    if (job.type === "Callback" && reportMonthOf(job) === month) {
      get(tech).callbacks += 1;
    }

    if (job.type !== "Estimate" && OPEN_STATUSES.has(job.status)) {
      get(tech).booked += 1;
    }
  }

  return [...acc.entries()]
    .map(([tech, a]) => ({
      tech,
      jobsDone: a.jobsDone,
      onTimePct: a.timed > 0 ? a.onTime / a.timed : null,
      timedCompletions: a.timed,
      callbacks: a.callbacks,
      callbackRate: a.jobsDone > 0 ? a.callbacks / a.jobsDone : null,
      booked: a.booked,
    }))
    .sort((x, y) => y.jobsDone - x.jobsDone || x.tech.localeCompare(y.tech));
}

// ─── 4. Callback / rework tracking ───────────────────────────────────────────

export interface CallbackJobRow {
  id: string;
  jobNumber: string;
  title: string;
  customerName: string;
  propertyName: string;
  tech: string;
  date: string | null;
  status: string;
}

export interface CallbackReport {
  total: number;
  byTech: Array<{ tech: string; count: number }>;
  jobs: CallbackJobRow[];
}

export function computeCallbackReport(
  jobs: ReportJobRow[],
  month: MonthKey,
): CallbackReport {
  const callbacks = jobs.filter(
    (job) => job.type === "Callback" && reportMonthOf(job) === month,
  );

  const techCounts = new Map<string, number>();
  const rows: CallbackJobRow[] = callbacks.map((job) => {
    const tech = techNameOf(job);
    techCounts.set(tech, (techCounts.get(tech) ?? 0) + 1);
    return {
      id: job.id,
      jobNumber: job.jobNumber,
      title: job.title,
      customerName: job.customerName,
      propertyName: job.propertyName,
      tech,
      date: scheduledDateOf(job) ?? toDatePart(job.createdAt),
      status: job.status,
    };
  });

  rows.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  const byTech = [...techCounts.entries()]
    .map(([tech, count]) => ({ tech, count }))
    .sort((a, b) => b.count - a.count || a.tech.localeCompare(b.tech));

  return { total: callbacks.length, byTech, jobs: rows };
}

// ─── Combined ────────────────────────────────────────────────────────────────

export interface OperationalReports {
  month: MonthKey;
  monthLabel: string;
  install: InstallReport;
  pipeline: PipelineReport;
  techScorecards: TechScorecard[];
  callbacks: CallbackReport;
}

export function computeOperationalReports(
  jobs: ReportJobRow[],
  activities: ReportStatusActivity[],
  month: MonthKey,
): OperationalReports {
  const timing = buildJobTiming(jobs, activities);
  return {
    month,
    monthLabel: monthLabel(month),
    install: computeInstallReport(jobs, month),
    pipeline: computePipelineReport(jobs, timing, month),
    techScorecards: computeTechScorecards(jobs, timing, month),
    callbacks: computeCallbackReport(jobs, month),
  };
}
