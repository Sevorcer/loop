import { ROUTES } from "@/lib/routes";
import { CALLBACK_LABELS, CALLBACK_TYPE } from "@/lib/callbacks";

function buildHref(basePath: string, params: Record<string, string>): string {
  const search = new URLSearchParams(params).toString();
  return search.length > 0 ? `${basePath}?${search}` : basePath;
}

export const ACTIONABLE_VIEWS = {
  scheduledToday: buildHref(ROUTES.JOBS, { status: "Scheduled", when: "today" }),
  inProgress: buildHref(ROUTES.JOBS, { status: "In Progress" }),
  onHold: buildHref(ROUTES.JOBS, { status: "On Hold" }),
  waitingOnInspection: buildHref(ROUTES.JOBS, { type: "Inspection", open: "true" }),
  callbacks: buildHref(ROUTES.JOBS, { type: CALLBACK_TYPE, open: "true" }),
  callbacksAll: buildHref(ROUTES.JOBS, { type: CALLBACK_TYPE }),
  unassigned: buildHref(ROUTES.JOBS, { unassigned: "true", open: "true" }),
  late: buildHref(ROUTES.JOBS, { late: "true", open: "true" }),
  problemJobs: buildHref(ROUTES.JOBS, { problem: "true", open: "true" }),
  completedToday: buildHref(ROUTES.JOBS, { status: "Completed", completedDate: "today" }),
  waitingOnPermit: ROUTES.DISPATCH,
  avgCompletion: ROUTES.DISPATCH,
} as const;

export type CommandCenterKPIKey =
  | "jobsToday"
  | "crewsDispatched"
  | "waitingOnInspection"
  | "waitingOnPermit"
  | "callbacks"
  | "completedToday"
  | "jobsRunningLate"
  | "avgCompletionHours";

interface KPIViewDefinition {
  label: string;
  description: string;
  helpText?: string;
  href: string;
}

export const COMMAND_CENTER_KPI_DEFINITIONS: Record<CommandCenterKPIKey, KPIViewDefinition> = {
  jobsToday: {
    label: "Scheduled Today",
    description: "Jobs with a schedule date of today",
    href: ACTIONABLE_VIEWS.scheduledToday,
  },
  crewsDispatched: {
    label: "People Working",
    description: "Distinct people with a job in progress",
    href: ACTIONABLE_VIEWS.inProgress,
  },
  waitingOnInspection: {
    label: "Waiting on Inspection",
    description: "Open inspection jobs",
    href: ACTIONABLE_VIEWS.waitingOnInspection,
  },
  waitingOnPermit: {
    label: "Waiting on Permit",
    description: "Dispatch plans blocked by permit constraints",
    helpText: "Derived from dispatch plan constraints marked blocking and mentioning permit.",
    href: ACTIONABLE_VIEWS.waitingOnPermit,
  },
  callbacks: {
    label: CALLBACK_LABELS.open,
    description: "Open jobs of type Callback",
    helpText: "Counts jobs whose type is Callback and are not Completed or Cancelled.",
    href: ACTIONABLE_VIEWS.callbacks,
  },
  completedToday: {
    label: "Completed Today",
    description: "Jobs with completion signal recorded today",
    helpText: "Prefers job activity completion events, with updated_at fallback for legacy records.",
    href: ACTIONABLE_VIEWS.completedToday,
  },
  jobsRunningLate: {
    label: "Jobs Running Late",
    description: "Open jobs past scheduled date",
    href: ACTIONABLE_VIEWS.late,
  },
  avgCompletionHours: {
    label: "Avg Completion",
    description: "Estimated hours for today’s completed dispatch plans",
    helpText: "Based on estimated job durations; actual completion timing isn't tracked yet.",
    href: ACTIONABLE_VIEWS.avgCompletion,
  },
};

export type DashboardMetricKey =
  | "scheduledToday"
  | "completedToday"
  | "onHold"
  | "unassignedJobs";

export const DASHBOARD_METRIC_DEFINITIONS: Record<DashboardMetricKey, KPIViewDefinition> = {
  scheduledToday: {
    label: "Scheduled Today",
    description: "Jobs with a schedule date of today",
    href: ACTIONABLE_VIEWS.scheduledToday,
  },
  completedToday: {
    label: "Completed Today",
    description: "Jobs with completion signal recorded today",
    helpText: COMMAND_CENTER_KPI_DEFINITIONS.completedToday.helpText,
    href: ACTIONABLE_VIEWS.completedToday,
  },
  onHold: {
    label: "On Hold",
    description: "Open jobs blocked and awaiting action",
    helpText: "Includes Waiting on Parts variants under the unified On Hold status.",
    href: ACTIONABLE_VIEWS.onHold,
  },
  unassignedJobs: {
    label: "Unassigned Jobs",
    description: "Open jobs without a technician assignment",
    href: ACTIONABLE_VIEWS.unassigned,
  },
};
