import type { Job } from "@/features/jobs/types/job";

export type DailyPlanStatus = "planning" | "active" | "completed";

export type PlanReadinessState = "ready" | "needs-attention";

export type CrewAvailabilityState =
  | "available"
  | "vacation"
  | "sick"
  | "training"
  | "late arrival"
  | "half day";

export type AlertSeverity = "info" | "warning" | "critical";
export type WorkloadStatus = "healthy" | "warning" | "overloaded";

export interface ChecklistItem {
  label: string;
  ready: boolean;
  critical?: boolean;
}

export interface JobConstraint {
  label: string;
  severity: "warning" | "critical";
}

export interface JobPlanDetail {
  city: string;
  equipment: string;
  estimatedHours: number;
  arrivalWindow: string;
  specialNotes?: string;
  permitRequired: boolean;
  photosRequired: boolean;
  materialsReady: boolean;
  readinessChecks: ChecklistItem[];
  materialChecklist: ChecklistItem[];
  constraints: JobConstraint[];
}

export interface DailyPlanJobOverride {
  readinessState?: PlanReadinessState;
}

export interface CrewProfile {
  id: string;
  technician: string;
  leadInstaller: string;
  helper?: string;
  truckName: string;
  truckInService: boolean;
  truckNote?: string;
  certifications: string[];
  experienceLevel: string;
  availability: CrewAvailabilityState;
  dailyCapacityHours: number;
  departureTime: string;
  truckChecks: ChecklistItem[];
}

export interface DayOverview {
  date: string;
  weatherLabel: string;
  weatherDetail: string;
  temperatureHigh: number;
  temperatureLow: number;
  summary: string;
  alerts: string[];
}

export interface JobReadinessSummary {
  score: number;
  state: "ready" | "warning" | "blocked";
  blockers: string[];
  warnings: string[];
  missingMaterials: string[];
}

export interface PlannedJob extends Job {
  planning: JobPlanDetail;
  readiness: JobReadinessSummary;
  manualState?: PlanReadinessState;
}

export interface CrewWorkload {
  crew: CrewProfile;
  jobs: PlannedJob[];
  hoursAssigned: number;
  readyJobs: number;
  warningJobs: number;
  blockerJobs: number;
  workloadStatus: WorkloadStatus;
  forecastCompletion: string;
}

export interface MorningDashboardMetrics {
  weatherLabel: string;
  weatherDetail: string;
  temperatureHigh: number;
  temperatureLow: number;
  activeCrews: number;
  totalCrews: number;
  jobsScheduled: number;
  availableInstallers: number;
  trucksInService: number;
  readinessScore: number;
  readyJobs: number;
  attentionJobs: number;
}

export interface MorningAlert {
  id: string;
  title: string;
  detail: string;
  severity: AlertSeverity;
}

export interface DailyPlanNote {
  date: string;
  content: string;
  updatedAt: string;
}

export interface DailyPlanStoreValue {
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  getNote: (date: string) => string;
  saveNote: (date: string, content: string) => void;
  getJobOverride: (jobId: string) => DailyPlanJobOverride | undefined;
  setJobOverride: (
    jobId: string,
    override: Partial<DailyPlanJobOverride>
  ) => void;
  getPlanStatus: (date: string) => DailyPlanStatus;
  getPlanActivation: (date: string) => DailyPlanActivation | undefined;
  activatePlan: (date: string) => void;
}

export interface DailyPlanActivation {
  date: string;
  status: DailyPlanStatus;
  startedAt: string;
}
