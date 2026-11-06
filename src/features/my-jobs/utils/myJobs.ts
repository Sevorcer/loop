import type { Job } from "@/features/jobs/types/job";
import { jobOverlapsDateRange } from "@/features/calendar/utils/calendarSchedule";
import { companyTimeZone, todayInCompanyTimeZone } from "@/lib/timezone";

/** One card on the My Jobs tab. Built server-side from a Job. */
export interface MyJobCard {
  id: string;
  jobNumber: string;
  title: string;
  type: string;
  status: Job["status"];
  customerName: string;
  /** Street part of the job location (everything before the city). */
  street: string;
  city: string;
  /** Full location string for the maps link. */
  location: string;
  /** Sort key / display start: ISO instant or YYYY-MM-DD for date-only jobs. */
  startAt: string | null;
  /** Other people on the job (the signed-in user removed). */
  withNames: string[];
  /** Customer phone, only when the viewer's role may read customers (RLS). */
  phone: string | null;
}

export interface MyJobsIdentity {
  userId: string;
  /** full_name / email, used only for legacy jobs that have no job_assignees rows. */
  names: string[];
}

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/**
 * True when the signed-in user is on the job. Same rule as the jobs RLS
 * policy (job_assignees row or jobs.assigned_user_id), plus the app-wide
 * legacy fallback: a job with no job_assignees rows whose assigned_to text
 * matches the user's name or email.
 */
export function isAssignedToMe(
  job: Pick<Job, "id" | "assignees" | "assignedTo">,
  me: MyJobsIdentity,
  assignedUserJobIds: ReadonlySet<string> = new Set(),
): boolean {
  const assignees = job.assignees ?? [];
  if (assignees.some((person) => person.id === me.userId)) return true;
  if (assignedUserJobIds.has(job.id)) return true;
  if (assignees.length > 0) return false;
  const legacy = norm(job.assignedTo);
  if (!legacy) return false;
  return me.names.some((name) => norm(name) === legacy);
}

export function jobStartKey(job: Pick<Job, "scheduledStartAt" | "arrivalWindowStartAt" | "scheduledFor">): string | null {
  return job.scheduledStartAt ?? job.arrivalWindowStartAt ?? job.scheduledFor ?? null;
}

/**
 * The signed-in user's jobs for `today` (company-timezone date), earliest
 * first. A job counts when its schedule touches today, or when it is In
 * Progress and was started today (startedTodayJobIds). Cancelled jobs are
 * left out. Soft-deleted jobs never reach here (the repository filters them).
 */
export function selectMyJobsToday(input: {
  jobs: readonly Job[];
  me: MyJobsIdentity;
  today: string;
  assignedUserJobIds?: ReadonlySet<string>;
  startedTodayJobIds?: ReadonlySet<string>;
}): Job[] {
  const started = input.startedTodayJobIds ?? new Set<string>();
  const seen = new Set<string>();
  const picked: Job[] = [];
  for (const job of input.jobs) {
    if (seen.has(job.id)) continue;
    if (job.status === "Cancelled") continue;
    if (!isAssignedToMe(job, input.me, input.assignedUserJobIds)) continue;
    const onToday = jobOverlapsDateRange(job, input.today, input.today);
    const startedToday = job.status === "In Progress" && started.has(job.id);
    if (!onToday && !startedToday) continue;
    seen.add(job.id);
    picked.push(job);
  }
  return picked.sort((a, b) => {
    const left = jobStartKey(a) ?? "9999";
    const right = jobStartKey(b) ?? "9999";
    if (left !== right) return left < right ? -1 : 1;
    return a.jobNumber.localeCompare(b.jobNumber);
  });
}

/** Current job: the first In Progress one, else the next one not yet Completed. */
export function pickCurrentJobId(cards: ReadonlyArray<Pick<MyJobCard, "id" | "status">>): string | null {
  const inProgress = cards.find((card) => card.status === "In Progress");
  if (inProgress) return inProgress.id;
  const next = cards.find((card) => card.status !== "Completed" && card.status !== "Cancelled");
  return next?.id ?? null;
}

export function countDone(cards: ReadonlyArray<Pick<MyJobCard, "status">>): number {
  return cards.filter((card) => card.status === "Completed").length;
}

/**
 * Split a location like "1805 Village Green Dr, #26, Mill Creek, WA, 98012"
 * into street ("1805 Village Green Dr, #26") and city ("Mill Creek").
 */
export function splitLocation(location: string | null | undefined): { street: string; city: string } {
  const parts = (location ?? "").split(",").map((part) => part.trim()).filter(Boolean);
  while (parts.length > 1 && /^\d{5}(-\d{4})?$/.test(parts[parts.length - 1])) parts.pop();
  if (parts.length > 1 && /^[A-Z]{2}$/.test(parts[parts.length - 1])) parts.pop();
  if (parts.length < 2) return { street: parts[0] ?? "", city: "" };
  const city = parts.pop() ?? "";
  return { street: parts.join(", "), city };
}

export function toMyJobCard(job: Job, me: MyJobsIdentity, phone: string | null = null): MyJobCard {
  const { street, city } = splitLocation(job.location);
  const myNames = new Set(me.names.map(norm));
  const withNames = (job.assignees ?? [])
    .filter((person) => person.id !== me.userId && !myNames.has(norm(person.name)))
    .map((person) => person.name.trim())
    .filter(Boolean);
  return {
    id: job.id,
    jobNumber: job.jobNumber,
    title: job.title,
    type: job.type,
    status: job.status,
    customerName: job.customerName || job.propertyName,
    street,
    city,
    location: job.location ?? "",
    startAt: jobStartKey(job),
    withNames,
    phone,
  };
}

/** "7:30 AM" for an instant; "Any time" for a date-only job. */
export function formatCardTime(startAt: string | null, timeZone = companyTimeZone()): string {
  if (!startAt || /^\d{4}-\d{2}-\d{2}$/.test(startAt)) return "Any time";
  const date = new Date(startAt);
  if (Number.isNaN(date.getTime())) return "Any time";
  return new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(date);
}

/** "Thursday, Nov 5" for the company-timezone today. */
export function formatTodayLabel(now = new Date(), timeZone = companyTimeZone()): string {
  return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long", month: "short", day: "numeric" }).format(now);
}

export { todayInCompanyTimeZone };

const MY_JOBS_ROLES = ["owner", "manager", "dispatch", "tech", "office", "sales"] as const;

/** Every internal role may open My Jobs (it only lists their own jobs). Portal never. */
export function canOpenMyJobs(role: string | null | undefined): boolean {
  return typeof role === "string" && (MY_JOBS_ROLES as readonly string[]).includes(role);
}
