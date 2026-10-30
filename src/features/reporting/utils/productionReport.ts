/**
 * Production report for completed jobs.
 *
 * Hours are scheduled hours: the job's scheduled start and finish when both
 * exist, otherwise the dispatch plan's estimated duration. LOOP does not
 * store clock-in, clock-out, or time entries.
 *
 * Revenue is optional cents on a job. The team is credited the full amount
 * once. Each person also receives an equal share. Leftover cents go to
 * people in alphabetical order. A person's full-job column repeats the whole
 * amount, so adding people counts a shared job more than once.
 */

import { formatTeamLabel, splitTeamNames } from "@/lib/teamLabel";

export const SCHEDULED_HOURS_LABEL = "Scheduled hours";

export const SCHEDULED_HOURS_NOTE =
  "Scheduled hours are the job's scheduled start and finish. When those times are missing, the dispatch estimate is used. Clock-in and time entries are not stored.";

export const REVENUE_SPLIT_NOTE =
  "Team revenue is the full job amount, counted once. A person's equal share splits that amount evenly, and leftover cents go to names in alphabetical order. Full job revenue on a person repeats the whole amount, so adding people counts a shared job more than once. Average ticket divides the amount by the jobs that have one recorded. For a person, average ticket uses the equal share.";

export interface ProductionPerson {
  id: string | null;
  name: string;
}

export interface ProductionSourceJob {
  id: string;
  jobNumber: string;
  status: string;
  title: string;
  customerName: string;
  assignedTo: string;
  assignees?: ProductionPerson[];
  completionTeam?: ProductionPerson[];
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  estimatedDurationHours: number | null;
  /** Null when this job has no stored revenue. */
  revenueCents: number | null;
  updatedAt: string;
}

export interface ProductionCompletion {
  jobId: string;
  createdAt: string;
}

export interface DateRange {
  from: string;
  to: string;
}

export type RangePreset = "this-week" | "this-month" | "last-month" | "custom";

export interface ProductionBucket {
  key: string;
  label: string;
  jobs: number;
  scheduledHours: number | null;
  revenueCents: number | null;
  averageTicketCents: number | null;
}

export interface ProductionPersonBucket extends ProductionBucket {
  equalShareCents: number | null;
  fullJobRevenueCents: number | null;
}

export interface ProductionJobLine {
  id: string;
  jobNumber: string;
  title: string;
  customerName: string;
  team: string;
  completedOn: string;
  scheduledHours: number | null;
  revenueCents: number | null;
}

export interface ProductionTotals {
  jobs: number;
  scheduledHours: number | null;
  jobsWithHours: number;
  revenueCents: number | null;
  jobsWithRevenue: number;
  averageTicketCents: number | null;
}

export interface ProductionReport {
  from: string;
  to: string;
  hoursLabel: typeof SCHEDULED_HOURS_LABEL;
  canSeeRevenue: boolean;
  totals: ProductionTotals;
  teams: ProductionBucket[];
  people: ProductionPersonBucket[];
  jobs: ProductionJobLine[];
}

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isDateKey(value: string): boolean {
  const match = DATE_KEY.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function utcDate(day: string): Date {
  const match = DATE_KEY.exec(day);
  if (!match) throw new Error("Invalid date.");
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function formatDay(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function weekRangeContaining(day: string): DateRange {
  const date = utcDate(day);
  const weekday = date.getUTCDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const monday = addDays(date, mondayOffset);
  return { from: formatDay(monday), to: formatDay(addDays(monday, 6)) };
}

export function monthRangeContaining(day: string, monthOffset = 0): DateRange {
  const date = utcDate(day);
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + monthOffset, 1));
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
  return { from: formatDay(start), to: formatDay(end) };
}

export function resolvePresetRange(preset: Exclude<RangePreset, "custom">, today: string): DateRange {
  if (!isDateKey(today)) throw new Error("Invalid date.");
  if (preset === "this-week") return weekRangeContaining(today);
  if (preset === "last-month") return monthRangeContaining(today, -1);
  return monthRangeContaining(today, 0);
}

export function assertDateRange(from: string, to: string): DateRange {
  if (!isDateKey(from) || !isDateKey(to) || from > to) throw new Error("Invalid date range.");
  const span = Math.round((utcDate(to).getTime() - utcDate(from).getTime()) / 86400000);
  if (span > 731) throw new Error("Invalid date range. Choose two years or less.");
  return { from, to };
}

function datePart(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
  return match && isDateKey(match[1]) ? match[1] : null;
}

function dedupePeople(people: readonly ProductionPerson[]): ProductionPerson[] {
  const unique: ProductionPerson[] = [];
  const seen = new Set<string>();
  for (const person of people) {
    const name = person.name.trim();
    if (!name) continue;
    const key = person.id ? `id:${person.id}` : `name:${name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({ id: person.id, name });
  }
  return unique;
}

/** People credited for a completed job. The completion snapshot wins. */
export function creditPeople(job: ProductionSourceJob): ProductionPerson[] {
  const snapshot = dedupePeople(job.completionTeam ?? []);
  if (job.status === "Completed" && snapshot.length > 0) return snapshot;
  const current = dedupePeople(job.assignees ?? []);
  if (current.length > 0) return current;
  return dedupePeople(splitTeamNames(job.assignedTo).map((name) => ({ id: null, name })));
}

export function scheduledHoursOf(job: Pick<
  ProductionSourceJob,
  "scheduledStartAt" | "scheduledEndAt" | "estimatedDurationHours"
>): number | null {
  const start = Date.parse(job.scheduledStartAt ?? "");
  const end = Date.parse(job.scheduledEndAt ?? "");
  if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
    return minutesToHours(Math.round((end - start) / 60000));
  }
  const estimate = job.estimatedDurationHours;
  if (typeof estimate === "number" && Number.isFinite(estimate) && estimate > 0) {
    return minutesToHours(Math.round(estimate * 60));
  }
  return null;
}

function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

function hoursToMinutes(hours: number): number {
  return Math.round(hours * 60);
}

export function equalShareCents(totalCents: number, count: number, sortedIndex: number): number {
  if (count <= 0) return 0;
  const total = Math.max(0, Math.round(totalCents));
  const base = Math.floor(total / count);
  const extra = total - base * count;
  return base + (sortedIndex < extra ? 1 : 0);
}

function personSortKey(person: ProductionPerson): string {
  return `${person.name.toLowerCase()}|${person.id ?? ""}`;
}

function completionDate(job: ProductionSourceJob, completedOn: ReadonlyMap<string, string>): string | null {
  return completedOn.get(job.id) ?? datePart(job.updatedAt);
}

function latestCompletions(events: readonly ProductionCompletion[]): Map<string, string> {
  const dates = new Map<string, string>();
  for (const event of events) {
    const day = datePart(event.createdAt);
    if (!day) continue;
    const previous = dates.get(event.jobId);
    if (!previous || day >= previous) dates.set(event.jobId, day);
  }
  return dates;
}

interface Running {
  jobs: number;
  minutes: number;
  jobsWithHours: number;
  revenueCents: number;
  jobsWithRevenue: number;
  equalShareCents: number;
  fullJobRevenueCents: number;
}

function blankRunning(): Running {
  return {
    jobs: 0,
    minutes: 0,
    jobsWithHours: 0,
    revenueCents: 0,
    jobsWithRevenue: 0,
    equalShareCents: 0,
    fullJobRevenueCents: 0,
  };
}

function asBucket(key: string, label: string, running: Running): ProductionBucket {
  const hasRevenue = running.jobsWithRevenue > 0;
  const revenueCents = hasRevenue ? running.revenueCents : null;
  return {
    key,
    label,
    jobs: running.jobs,
    scheduledHours: running.jobsWithHours > 0 ? minutesToHours(running.minutes) : null,
    revenueCents,
    averageTicketCents:
      hasRevenue && running.jobsWithRevenue > 0
        ? Math.round(running.revenueCents / running.jobsWithRevenue)
        : null,
  };
}

function compareBuckets(left: ProductionBucket, right: ProductionBucket): number {
  const revenueDelta = (right.revenueCents ?? -1) - (left.revenueCents ?? -1);
  if (revenueDelta !== 0) return revenueDelta;
  if (right.jobs !== left.jobs) return right.jobs - left.jobs;
  return left.label.localeCompare(right.label, "en", { sensitivity: "base" });
}

export function computeProductionReport(
  jobs: readonly ProductionSourceJob[],
  completions: readonly ProductionCompletion[],
  range: DateRange,
): ProductionReport {
  const completedOn = latestCompletions(completions);
  const included = jobs
    .filter((job) => job.status === "Completed")
    .map((job) => ({ job, completedOn: completionDate(job, completedOn) }))
    .filter((row): row is { job: ProductionSourceJob; completedOn: string } => {
      return row.completedOn != null && row.completedOn >= range.from && row.completedOn <= range.to;
    })
    .sort((left, right) => {
      const byDate = left.completedOn.localeCompare(right.completedOn);
      if (byDate !== 0) return byDate;
      return left.job.jobNumber.localeCompare(right.job.jobNumber, "en");
    });

  const totals = blankRunning();
  const teams = new Map<string, { label: string; running: Running }>();
  const people = new Map<string, { label: string; running: Running }>();
  const lines: ProductionJobLine[] = [];

  for (const row of included) {
    const credited = creditPeople(row.job);
    const names = credited.map((person) => person.name);
    const teamLabel = names.length > 0 ? formatTeamLabel(names) : "Unassigned";
    const teamKey = names.length > 0
      ? credited.map((person) => person.id ?? person.name.toLowerCase()).sort().join("|")
      : "unassigned";
    const hours = scheduledHoursOf(row.job);
    const revenue = finiteCents(row.job.revenueCents);
    const sorted = [...credited].sort((left, right) => personSortKey(left).localeCompare(personSortKey(right)));

    addJob(totals, hours, revenue, revenue);
    const team = teams.get(teamKey) ?? { label: teamLabel, running: blankRunning() };
    addJob(team.running, hours, revenue, revenue);
    teams.set(teamKey, team);

    if (sorted.length === 0) {
      const person = people.get("unassigned") ?? { label: "Unassigned", running: blankRunning() };
      addJob(person.running, hours, revenue, revenue);
      people.set("unassigned", person);
    } else {
      sorted.forEach((person, index) => {
        const key = person.id ?? `name:${person.name.toLowerCase()}`;
        const entry = people.get(key) ?? { label: person.name, running: blankRunning() };
        const share = revenue == null ? null : equalShareCents(revenue, sorted.length, index);
        addJob(entry.running, hours, share, revenue);
        people.set(key, entry);
      });
    }

    lines.push({
      id: row.job.id,
      jobNumber: row.job.jobNumber,
      title: row.job.title,
      customerName: row.job.customerName,
      team: teamLabel,
      completedOn: row.completedOn,
      scheduledHours: hours,
      revenueCents: revenue,
    });
  }

  const teamRows = [...teams.entries()]
    .map(([key, entry]) => asBucket(key, entry.label, entry.running))
    .sort(compareBuckets);

  const peopleRows = [...people.entries()]
    .map(([key, entry]) => {
      const bucket = asBucket(key, entry.label, entry.running);
      const hasRevenue = entry.running.jobsWithRevenue > 0;
      return {
        ...bucket,
        equalShareCents: hasRevenue ? entry.running.equalShareCents : null,
        fullJobRevenueCents: hasRevenue ? entry.running.fullJobRevenueCents : null,
        averageTicketCents:
          hasRevenue && entry.running.jobsWithRevenue > 0
            ? Math.round(entry.running.equalShareCents / entry.running.jobsWithRevenue)
            : null,
      };
    })
    .sort((left, right) => {
      const shareDelta = (right.equalShareCents ?? -1) - (left.equalShareCents ?? -1);
      if (shareDelta !== 0) return shareDelta;
      return compareBuckets(left, right);
    });

  return {
    from: range.from,
    to: range.to,
    hoursLabel: SCHEDULED_HOURS_LABEL,
    canSeeRevenue: true,
    totals: {
      jobs: totals.jobs,
      scheduledHours: totals.jobsWithHours > 0 ? minutesToHours(totals.minutes) : null,
      jobsWithHours: totals.jobsWithHours,
      revenueCents: totals.jobsWithRevenue > 0 ? totals.revenueCents : null,
      jobsWithRevenue: totals.jobsWithRevenue,
      averageTicketCents:
        totals.jobsWithRevenue > 0 ? Math.round(totals.revenueCents / totals.jobsWithRevenue) : null,
    },
    teams: teamRows,
    people: peopleRows,
    jobs: lines,
  };
}

function finiteCents(value: number | null): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return Math.round(value);
}

function addJob(running: Running, hours: number | null, shareOrFull: number | null, full: number | null): void {
  running.jobs += 1;
  if (hours != null) {
    running.minutes += hoursToMinutes(hours);
    running.jobsWithHours += 1;
  }
  if (shareOrFull != null) {
    running.revenueCents += shareOrFull;
    running.equalShareCents += shareOrFull;
    running.jobsWithRevenue += 1;
  }
  if (full != null) running.fullJobRevenueCents += full;
}

export function redactProductionReport(report: ProductionReport): ProductionReport {
  const hideBucket = (bucket: ProductionBucket): ProductionBucket => ({
    ...bucket,
    revenueCents: null,
    averageTicketCents: null,
  });
  return {
    ...report,
    canSeeRevenue: false,
    totals: {
      ...report.totals,
      revenueCents: null,
      jobsWithRevenue: 0,
      averageTicketCents: null,
    },
    teams: report.teams.map(hideBucket),
    people: report.people.map((person) => ({
      ...hideBucket(person),
      equalShareCents: null,
      fullJobRevenueCents: null,
    })),
    jobs: report.jobs.map((job) => ({ ...job, revenueCents: null })),
  };
}

export function formatRevenueCents(cents: number | null): string {
  if (cents == null) return "Not recorded";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export function formatScheduledHours(hours: number | null): string {
  if (hours == null) return "—";
  return `${hours.toLocaleString("en-US", { maximumFractionDigits: 2 })} h`;
}

function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

function csvLine(cells: readonly string[]): string {
  return cells.map(csvCell).join(",");
}

export function productionReportToCsv(report: ProductionReport): string {
  const lines: string[] = [
    csvLine([
      "Note",
      report.canSeeRevenue
        ? `${SCHEDULED_HOURS_NOTE} ${REVENUE_SPLIT_NOTE}`
        : SCHEDULED_HOURS_NOTE,
    ]),
    "",
  ];

  const moneyHeaders = report.canSeeRevenue ? ["Revenue", "Average ticket"] : [];
  lines.push(csvLine(["Teams", "Jobs", ...moneyHeaders, SCHEDULED_HOURS_LABEL]));
  for (const team of report.teams) {
    lines.push(csvLine([
      team.label,
      String(team.jobs),
      ...(report.canSeeRevenue
        ? [formatRevenueCents(team.revenueCents), formatRevenueCents(team.averageTicketCents)]
        : []),
      formatScheduledHours(team.scheduledHours),
    ]));
  }

  lines.push("");
  const personMoney = report.canSeeRevenue
    ? ["Equal share", "Full job revenue", "Average ticket"]
    : [];
  lines.push(csvLine(["People", "Jobs", ...personMoney, SCHEDULED_HOURS_LABEL]));
  for (const person of report.people) {
    lines.push(csvLine([
      person.label,
      String(person.jobs),
      ...(report.canSeeRevenue
        ? [
            formatRevenueCents(person.equalShareCents),
            formatRevenueCents(person.fullJobRevenueCents),
            formatRevenueCents(person.averageTicketCents),
          ]
        : []),
      formatScheduledHours(person.scheduledHours),
    ]));
  }

  lines.push("");
  lines.push(csvLine([
    "Job",
    "Title",
    "Customer",
    "Team",
    "Completed",
    ...(report.canSeeRevenue ? ["Revenue"] : []),
    SCHEDULED_HOURS_LABEL,
  ]));
  for (const job of report.jobs) {
    lines.push(csvLine([
      job.jobNumber,
      job.title,
      job.customerName,
      job.team,
      job.completedOn,
      ...(report.canSeeRevenue ? [formatRevenueCents(job.revenueCents)] : []),
      formatScheduledHours(job.scheduledHours),
    ]));
  }

  return `${lines.join("\n")}\n`;
}
