import type { Job } from "@/features/jobs/types/job";

export function getTodayDate(): string {
  return new Date().toISOString().split("T")[0];
}

export function addDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export function isToday(date: string): boolean {
  return date === getTodayDate();
}

export function isTomorrow(date: string): boolean {
  return date === addDays(getTodayDate(), 1);
}

export function isYesterday(date: string): boolean {
  return date === addDays(getTodayDate(), -1);
}

export function formatPlanDate(date: string): string {
  return new Date(date + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateShort(date: string): string {
  return new Date(date + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function getDayLabel(date: string): string {
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  if (isYesterday(date)) return "Yesterday";
  return formatPlanDate(date);
}

export function getJobsForDate(jobs: Job[], date: string): Job[] {
  return jobs.filter((job) => job.scheduledFor === date);
}

export function getAssignedJobs(jobs: Job[]): Job[] {
  return jobs.filter((job) => job.assignedTo.trim().length > 0);
}

export function getUnassignedJobs(jobs: Job[]): Job[] {
  return jobs.filter((job) => !job.assignedTo.trim());
}

export function groupJobsByTechnician(jobs: Job[]): Map<string, Job[]> {
  const groups = new Map<string, Job[]>();

  for (const job of jobs) {
    const key = job.assignedTo.trim();

    if (!key) continue;

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key)!.push(job);
  }

  return groups;
}

export interface ReadinessMetrics {
  totalPlanned: number;
  assigned: number;
  unassigned: number;
  inProgress: number;
  completed: number;
  onHold: number;
  highPriority: number;
  atRisk: number;
  readinessScore: number;
}

export function computeReadiness(jobs: Job[]): ReadinessMetrics {
  const totalPlanned = jobs.length;
  const assigned = jobs.filter((j) => j.assignedTo.trim().length > 0).length;
  const unassigned = jobs.filter((j) => !j.assignedTo.trim()).length;
  const inProgress = jobs.filter((j) => j.status === "In Progress").length;
  const completed = jobs.filter((j) => j.status === "Completed").length;
  const onHold = jobs.filter((j) => j.status === "On Hold").length;
  const cancelled = jobs.filter((j) => j.status === "Cancelled").length;
  const highPriority = jobs.filter((j) => j.priority === "High").length;

  const atRisk = jobs.filter(
    (j) =>
      j.status === "On Hold" ||
      !j.assignedTo.trim() ||
      (j.priority === "High" && j.status !== "In Progress" && j.status !== "Completed")
  ).length;

  let score = 100;

  if (totalPlanned > 0) {
    score -= (unassigned / totalPlanned) * 40;
    score -= (onHold / totalPlanned) * 30;
    score -= (cancelled / totalPlanned) * 15;
  }

  return {
    totalPlanned,
    assigned,
    unassigned,
    inProgress,
    completed,
    onHold,
    highPriority,
    atRisk,
    readinessScore: Math.max(0, Math.min(100, Math.round(score))),
  };
}

export function getReadinessStatus(score: number): {
  label: string;
  color: string;
} {
  if (score >= 85) return { label: "Ready to Execute", color: "text-green-400" };
  if (score >= 60) return { label: "Needs Attention", color: "text-yellow-400" };
  return { label: "Not Ready", color: "text-red-400" };
}
