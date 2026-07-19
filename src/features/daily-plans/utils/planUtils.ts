import { getCrewProfilesForDate, getDayOverview, getJobPlanDetail } from "../data/mockMorningOperations";
import type {
  CrewProfile,
  CrewWorkload,
  DailyPlanJobOverride,
  JobReadinessSummary,
  MorningAlert,
  MorningDashboardMetrics,
  PlannedJob,
  WorkloadStatus,
} from "../types/dailyPlan";
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

export function getUnassignedJobs(jobs: PlannedJob[]): PlannedJob[] {
  return jobs.filter((job) => !job.assignedTo.trim());
}

export function formatHours(hours: number): string {
  const rounded = Math.round(hours * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}h` : `${rounded.toFixed(1)}h`;
}

function getAvailableInstallerCountForCrew(crew: CrewProfile): number {
  switch (crew.availability) {
    case "vacation":
    case "sick":
      return 0;
    case "training":
      return 0;
    case "half day":
      return crew.helper ? 1 : 0;
    default:
      return crew.helper ? 2 : 1;
  }
}

function parseClockValue(value: string): { hour: number; minute: number } {
  const match = value.match(/(\d{1,2}):(\d{2})\s?(AM|PM)/i);

  if (!match) {
    return { hour: 7, minute: 0 };
  }

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3].toUpperCase();

  if (meridiem === "PM" && hour !== 12) {
    hour += 12;
  }

  if (meridiem === "AM" && hour === 12) {
    hour = 0;
  }

  return { hour, minute };
}

function formatClockValue(hour: number, minute: number): string {
  const normalizedHour = ((hour % 24) + 24) % 24;
  const meridiem = normalizedHour >= 12 ? "PM" : "AM";
  const twelveHour = normalizedHour % 12 || 12;
  return `${twelveHour}:${String(minute).padStart(2, "0")} ${meridiem}`;
}

function addHoursToClock(value: string, hours: number): string {
  const clock = parseClockValue(value);
  const totalMinutes = clock.hour * 60 + clock.minute + Math.round(hours * 60);
  const nextHour = Math.floor(totalMinutes / 60);
  const nextMinute = ((totalMinutes % 60) + 60) % 60;
  return formatClockValue(nextHour, nextMinute);
}

export function buildPlannedJob(
  job: Job,
  override?: DailyPlanJobOverride
): PlannedJob {
  const planning = getJobPlanDetail(job.id);

  const blockers = [
    ...planning.readinessChecks
      .filter((check) => !check.ready && check.critical)
      .map((check) => check.label),
    ...planning.materialChecklist
      .filter((item) => !item.ready && item.critical)
      .map((item) => item.label),
    ...planning.constraints
      .filter((constraint) => constraint.severity === "critical")
      .map((constraint) => constraint.label),
  ];

  const warnings = [
    ...planning.readinessChecks
      .filter((check) => !check.ready && !check.critical)
      .map((check) => check.label),
    ...planning.materialChecklist
      .filter((item) => !item.ready && !item.critical)
      .map((item) => item.label),
    ...planning.constraints
      .filter((constraint) => constraint.severity === "warning")
      .map((constraint) => constraint.label),
  ];

  if (!planning.materialsReady && !blockers.includes("Materials not staged")) {
    warnings.push("Materials not staged");
  }

  if (job.status === "On Hold") {
    blockers.push("Job on hold");
  }

  if (!job.assignedTo.trim()) {
    blockers.push("Crew assignment required");
  }

  if (override?.readinessState === "needs-attention") {
    warnings.unshift("Manual morning attention flag");
  }

  const totalChecks = planning.readinessChecks.length + planning.materialChecklist.length;
  const readyChecks =
    planning.readinessChecks.filter((check) => check.ready).length +
    planning.materialChecklist.filter((item) => item.ready).length;

  let score = totalChecks > 0 ? Math.round((readyChecks / totalChecks) * 100) : 100;

  if (blockers.length > 0) {
    score = Math.min(score, 55);
  } else if (warnings.length > 0) {
    score = Math.min(score, 78);
  }

  if (override?.readinessState === "ready" && blockers.length === 0) {
    score = Math.max(score, 90);
  }

  if (override?.readinessState === "needs-attention") {
    score = Math.min(score, 64);
  }

  const readiness: JobReadinessSummary = {
    score,
    state: blockers.length > 0 ? "blocked" : score >= 85 ? "ready" : "warning",
    blockers,
    warnings,
    missingMaterials: planning.materialChecklist
      .filter((item) => !item.ready)
      .map((item) => item.label),
  };

  return {
    ...job,
    planning,
    readiness,
    manualState: override?.readinessState,
  };
}

function getCrewWorkloadStatus(
  crew: CrewProfile,
  hoursAssigned: number,
  jobs: PlannedJob[]
): WorkloadStatus {
  const hasBlocker = jobs.some((job) => job.readiness.state === "blocked");
  const hasWarning = jobs.some((job) => job.readiness.state === "warning");

  if (crew.availability === "vacation" || crew.availability === "sick") {
    return "overloaded";
  }

  if (
    hoursAssigned > crew.dailyCapacityHours ||
    (!crew.truckInService && jobs.length > 0) ||
    hasBlocker
  ) {
    return "overloaded";
  }

  if (
    crew.availability === "late arrival" ||
    crew.availability === "half day" ||
    hoursAssigned >= crew.dailyCapacityHours * 0.8 ||
    hasWarning
  ) {
    return "warning";
  }

  return "healthy";
}

export function buildCrewWorkloads(
  plannedJobs: PlannedJob[],
  date: string
): CrewWorkload[] {
  return getCrewProfilesForDate(date)
    .map((crew) => {
      const jobs = plannedJobs.filter((job) => job.assignedTo === crew.technician);
      const hoursAssigned = jobs.reduce(
        (sum, job) => sum + job.planning.estimatedHours,
        0
      );
      const readyJobs = jobs.filter((job) => job.readiness.state === "ready").length;
      const warningJobs = jobs.filter((job) => job.readiness.state === "warning").length;
      const blockerJobs = jobs.filter((job) => job.readiness.state === "blocked").length;

      return {
        crew,
        jobs,
        hoursAssigned,
        readyJobs,
        warningJobs,
        blockerJobs,
        workloadStatus: getCrewWorkloadStatus(crew, hoursAssigned, jobs),
        forecastCompletion:
          jobs.length > 0
            ? addHoursToClock(crew.departureTime, hoursAssigned + 0.75)
            : "Open capacity",
      } satisfies CrewWorkload;
    })
    .sort((left, right) => {
      if (left.jobs.length === 0 && right.jobs.length > 0) return 1;
      if (left.jobs.length > 0 && right.jobs.length === 0) return -1;
      return left.crew.technician.localeCompare(right.crew.technician);
    });
}

export function buildMorningDashboardMetrics(
  plannedJobs: PlannedJob[],
  crewWorkloads: CrewWorkload[],
  date: string
): MorningDashboardMetrics {
  const dayOverview = getDayOverview(date);
  const activeCrews = crewWorkloads.filter(
    (crew) =>
      crew.crew.availability !== "vacation" &&
      crew.crew.availability !== "sick" &&
      crew.crew.availability !== "training"
  );
  const availableInstallers = crewWorkloads.reduce(
    (sum, workload) => sum + getAvailableInstallerCountForCrew(workload.crew),
    0
  );
  const trucksInService = activeCrews.filter((crew) => crew.crew.truckInService).length;
  const readyJobs = plannedJobs.filter((job) => job.readiness.state === "ready").length;
  const attentionJobs = plannedJobs.length - readyJobs;
  const averageJobScore =
    plannedJobs.length > 0
      ? plannedJobs.reduce((sum, job) => sum + job.readiness.score, 0) /
        plannedJobs.length
      : 100;
  const crewHealthScore =
    crewWorkloads.length > 0
      ? (crewWorkloads.reduce((sum, workload) => {
          if (workload.workloadStatus === "healthy") return sum + 100;
          if (workload.workloadStatus === "warning") return sum + 70;
          return sum + 40;
        }, 0) /
          crewWorkloads.length)
      : 100;
  const truckScore =
    activeCrews.length > 0 ? (trucksInService / activeCrews.length) * 100 : 100;

  return {
    weatherLabel: dayOverview.weatherLabel,
    weatherDetail: dayOverview.weatherDetail,
    temperatureHigh: dayOverview.temperatureHigh,
    temperatureLow: dayOverview.temperatureLow,
    activeCrews: activeCrews.length,
    totalCrews: crewWorkloads.length,
    jobsScheduled: plannedJobs.length,
    availableInstallers,
    trucksInService,
    readinessScore: Math.round(
      averageJobScore * 0.7 + crewHealthScore * 0.2 + truckScore * 0.1
    ),
    readyJobs,
    attentionJobs,
  };
}

export function buildMorningAlerts(
  plannedJobs: PlannedJob[],
  crewWorkloads: CrewWorkload[],
  date: string
): MorningAlert[] {
  const alerts: MorningAlert[] = [];
  const dayOverview = getDayOverview(date);

  dayOverview.alerts.forEach((detail, index) => {
    alerts.push({
      id: `day-${index}`,
      title: "Day advisory",
      detail,
      severity: detail.toLowerCase().includes("heat") ? "warning" : "info",
    });
  });

  plannedJobs
    .filter((job) => job.readiness.state === "blocked")
    .slice(0, 4)
    .forEach((job) => {
      alerts.push({
        id: job.id,
        title: `${job.jobNumber} requires intervention`,
        detail: job.readiness.blockers[0] ?? "Readiness blocker detected",
        severity: job.priority === "High" ? "critical" : "warning",
      });
    });

  crewWorkloads.forEach((workload) => {
    if (workload.jobs.length > 0 && !workload.crew.truckInService) {
      alerts.push({
        id: `${workload.crew.id}-truck`,
        title: `${workload.crew.truckName} unavailable`,
        detail: workload.crew.truckNote ?? "Truck is not ready for dispatch.",
        severity: "critical",
      });
    }

    if (workload.jobs.length > 0 && workload.crew.availability === "late arrival") {
      alerts.push({
        id: `${workload.crew.id}-availability`,
        title: `${workload.crew.leadInstaller} is arriving late`,
        detail: "Dispatch should rebalance if the first stop slips.",
        severity: "warning",
      });
    }
  });

  return alerts.sort((left, right) => {
    const priority = { critical: 0, warning: 1, info: 2 };
    return priority[left.severity] - priority[right.severity];
  });
}

export function getReadinessStatus(score: number): {
  label: string;
  color: string;
} {
  if (score >= 85) return { label: "Ready to Launch", color: "text-green-400" };
  if (score >= 60) return { label: "Needs Attention", color: "text-yellow-400" };
  return { label: "Not Ready", color: "text-red-400" };
}

export function getDayOverviewSummary(date: string): string {
  return getDayOverview(date).summary;
}
