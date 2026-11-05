import type { Job } from "@/features/jobs/types/job";
import type { CrewRecord } from "../data/fieldCrews";
import { scheduledCompanyDate } from "@/features/jobs/utils/schedulingTime";

const OFFICE_EDIT_ROLES = new Set(["owner", "manager", "dispatch", "office"]);

/** Roles that may view and edit Daily Plans (matches navPermissions). */
export function canEditDailyPlans(role: string | null | undefined): boolean {
  return typeof role === "string" && OFFICE_EDIT_ROLES.has(role);
}

/** Roles that may open Daily Plans at all. Tech / sales / portal cannot. */
export function canViewDailyPlans(role: string | null | undefined): boolean {
  return canEditDailyPlans(role);
}

/**
 * People currently on a job. Prefer job_assignees rows; fall back to the
 * legacy assignedTo string so older rows still show a name.
 */
export function jobAssigneeNames(job: Pick<Job, "assignees" | "assignedTo">): string[] {
  const fromAssignees = (job.assignees ?? [])
    .map((person) => person.name.trim())
    .filter(Boolean);
  if (fromAssignees.length > 0) {
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const name of fromAssignees) {
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(name);
    }
    return unique;
  }
  const legacy = job.assignedTo.trim();
  return legacy ? [legacy] : [];
}

export function jobIsAssigned(job: Pick<Job, "assignees" | "assignedTo">): boolean {
  return jobAssigneeNames(job).length > 0;
}

/** Display time for the day table: scheduled start, else arrival window, else em dash. */
export function formatJobDayTime(job: Pick<Job, "scheduledStartAt" | "arrivalWindowStartAt">): string {
  const iso = job.scheduledStartAt || job.arrivalWindowStartAt;
  if (!iso) return "—";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "—";
  return new Date(ms).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Sort the day's jobs: scheduled_start_at, then arrival window, then job number.
 */
export function sortJobsForDayTable(jobs: Job[]): Job[] {
  return [...jobs].sort((a, b) => {
    const aTime = Date.parse(a.scheduledStartAt || a.arrivalWindowStartAt || "") || Number.POSITIVE_INFINITY;
    const bTime = Date.parse(b.scheduledStartAt || b.arrivalWindowStartAt || "") || Number.POSITIVE_INFINITY;
    if (aTime !== bTime) return aTime - bTime;
    return a.jobNumber.localeCompare(b.jobNumber, undefined, { numeric: true });
  });
}

function nameKey(value: string): string {
  return value.trim().toLowerCase();
}

function crewMemberNames(crew: CrewRecord): string[] {
  const names: string[] = [];
  const lead = (crew.lead_installer ?? "").trim();
  if (lead) names.push(lead);
  if (Array.isArray(crew.members)) {
    for (const member of crew.members) {
      if (typeof member === "string" && member.trim()) names.push(member.trim());
      else if (member && typeof member === "object" && "name" in member) {
        const name = (member as { name?: unknown }).name;
        if (typeof name === "string" && name.trim()) names.push(name.trim());
      }
    }
  }
  return names;
}

/**
 * Best-effort truck/crew label for a job from people on it + crews membership.
 * Does not invent data when nothing matches.
 */
export function crewLabelForJob(
  job: Pick<Job, "assignees" | "assignedTo">,
  crews: CrewRecord[],
): string {
  const people = jobAssigneeNames(job).map(nameKey);
  if (people.length === 0) return "—";

  for (const crew of crews) {
    const members = crewMemberNames(crew).map(nameKey);
    if (members.some((member) => people.includes(member))) {
      const truck = (crew.van_name ?? "").trim();
      const name = (crew.name ?? "").trim();
      if (truck && name && truck !== name) return `${name} · ${truck}`;
      return truck || name || "—";
    }
  }
  return "—";
}

/** Jobs on a specific company date (selected day, not always "today"). */
export function getJobsForSelectedDate(jobs: Job[], date: string): Job[] {
  return jobs.filter((job) => {
    if (!job.scheduledFor) return false;
    const start = job.scheduledFor.slice(0, 10);
    const end = scheduledCompanyDate(job.scheduledEndAt) ?? start;
    return date >= start && date <= end;
  });
}

/** Upcoming jobs in the next N days after `date` (exclusive of `date`). */
export function getShortUpcomingJobs(jobs: Job[], date: string, days = 3): Job[] {
  const end = (() => {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() + days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  })();
  return jobs
    .filter((job) => job.scheduledFor != null && job.scheduledFor > date && job.scheduledFor <= end)
    .sort((a, b) => (a.scheduledFor! < b.scheduledFor! ? -1 : 1));
}

export function countPeopleWorking(jobs: Pick<Job, "assignees" | "assignedTo">[]): number {
  const seen = new Set<string>();
  for (const job of jobs) {
    for (const name of jobAssigneeNames(job)) {
      seen.add(nameKey(name));
    }
  }
  return seen.size;
}

export function customerSiteLabel(job: Pick<Job, "customerName" | "propertyName" | "location" | "title">): string {
  const customer = job.customerName.trim();
  const site = job.propertyName.trim() || job.location.trim();
  if (customer && site && site.toLowerCase() !== customer.toLowerCase()) {
    return `${customer} · ${site}`;
  }
  return customer || site || job.title || "—";
}

export function jobAddressForPrint(job: Pick<Job, "location" | "propertyName">): string {
  return job.location.trim() || job.propertyName.trim() || "—";
}
