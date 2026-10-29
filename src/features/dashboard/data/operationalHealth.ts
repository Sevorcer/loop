import type { DashboardSummary } from "@/repositories/dashboard";

export const NO_DATA_LABEL = "—";

export interface AttentionItem {
  id: string;
  title: string;
  description: string;
}

export interface DashboardJobSignal {
  id: string;
  jobNumber: string;
  title: string;
  status: string;
  type: string;
  assignedTo: string;
}

export interface OperationalSignal {
  label: string;
  value: string;
}

export interface OperationalHealth {
  title: string;
  status: string;
  context: string;
  signals: OperationalSignal[];
}

function hasWorkToday(summary: Pick<DashboardSummary, "scheduledToday" | "activeJobs">): boolean {
  return summary.scheduledToday > 0 || summary.activeJobs > 0;
}

export function dispatchStatusLabel(
  summary: Pick<DashboardSummary, "scheduledToday" | "activeJobs" | "unassignedJobs" | "blockedJobs">,
): string {
  if (!hasWorkToday(summary)) return "No jobs today";
  if (summary.unassignedJobs > 0 || summary.blockedJobs > 0) return "Needs attention";
  return "On schedule";
}

export function buildOperationalHealth(summary: DashboardSummary): OperationalHealth {
  const needsAttention = summary.unassignedJobs > 0 || summary.blockedJobs > 0;
  const quiet = !hasWorkToday(summary) && !needsAttention;

  const status = needsAttention ? "Needs attention" : quiet ? "Quiet" : "Healthy";
  const context = quiet
    ? "No jobs are scheduled or in progress today."
    : `${summary.scheduledToday} scheduled today · ${summary.unassignedJobs} unassigned · ${summary.openCallbacks} open callbacks`;

  return {
    title: "Operational Health",
    status,
    context,
    signals: [
      { label: "Today's Jobs", value: String(summary.scheduledToday) },
      { label: "Active Crews", value: String(summary.activeCrews) },
      { label: "Callbacks", value: String(summary.openCallbacks) },
      { label: "Open Estimates", value: String(summary.openEstimates) },
      { label: "Dispatch Status", value: dispatchStatusLabel(summary) },
    ],
  };
}

function isOpen(status: string): boolean {
  const normalized = status.trim().toLowerCase();
  return normalized !== "completed" && normalized !== "cancelled" && normalized !== "canceled";
}

function isUnassigned(assignedTo: string): boolean {
  return assignedTo.trim().length === 0;
}

/**
 * Builds the dashboard attention list from real open jobs.
 * Returns an empty list when nothing is blocked, unassigned, or waiting as a callback.
 */
export function buildAttentionItems(jobs: DashboardJobSignal[]): AttentionItem[] {
  const items: AttentionItem[] = [];
  const seen = new Set<string>();

  function push(job: DashboardJobSignal, title: string, description: string) {
    if (seen.has(job.id) || items.length >= 6) return;
    seen.add(job.id);
    items.push({ id: job.id, title, description });
  }

  for (const job of jobs) {
    if (!isOpen(job.status)) continue;
    const label = job.jobNumber ? `${job.jobNumber} · ${job.title}` : job.title;
    if (job.type.trim().toLowerCase() === "callback" && isUnassigned(job.assignedTo)) {
      push(job, "Callback waiting assignment", `${label} has not been assigned yet.`);
    }
  }

  for (const job of jobs) {
    if (!isOpen(job.status)) continue;
    const label = job.jobNumber ? `${job.jobNumber} · ${job.title}` : job.title;
    if (job.status.trim().toLowerCase().replace(/[_-]+/g, " ") === "on hold" || job.status.trim().toLowerCase() === "waiting on parts") {
      push(job, "Job on hold", label);
    }
  }

  for (const job of jobs) {
    if (!isOpen(job.status) || !isUnassigned(job.assignedTo)) continue;
    const label = job.jobNumber ? `${job.jobNumber} · ${job.title}` : job.title;
    push(job, "Job needs a technician", label);
  }

  return items;
}
