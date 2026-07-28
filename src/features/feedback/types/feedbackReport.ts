/**
 * Feedback report domain types — Sprint 7 Mini-Epic
 *
 * Used by: UI components, repositories, services, and API routes.
 */

// ─── Severity ─────────────────────────────────────────────────────────────────

export type FeedbackSeverity = "P0" | "P1" | "P2" | "P3";

export const FEEDBACK_SEVERITY_VALUES: readonly FeedbackSeverity[] = [
  "P0",
  "P1",
  "P2",
  "P3",
];

export const FEEDBACK_SEVERITY_LABELS: Record<FeedbackSeverity, string> = {
  P0: "P0 — Critical",
  P1: "P1 — High",
  P2: "P2 — Medium",
  P3: "P3 — Low",
};

// ─── Status ───────────────────────────────────────────────────────────────────

export type FeedbackStatus =
  | "new"
  | "triaged"
  | "in_progress"
  | "resolved"
  | "wontfix";

export const FEEDBACK_STATUS_VALUES: readonly FeedbackStatus[] = [
  "new",
  "triaged",
  "in_progress",
  "resolved",
  "wontfix",
];

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: "New",
  triaged: "Triaged",
  in_progress: "In Progress",
  resolved: "Resolved",
  wontfix: "Won't Fix",
};

// ─── Domain type ──────────────────────────────────────────────────────────────

export interface FeedbackReport {
  id: string;
  orgId: string;
  createdAt: string;
  createdByUserId: string | null;
  createdByRole: string;
  severity: FeedbackSeverity;
  intendedAction: string;
  actualResult: string;
  routePath: string;
  contextJobId: string | null;
  contextCustomerId: string | null;
  contextPropertyId: string | null;
  screenshotUrl: string | null;
  status: FeedbackStatus;
  triageNotes: string | null;
}

// ─── Write inputs ─────────────────────────────────────────────────────────────

export interface CreateFeedbackReportInput {
  severity: FeedbackSeverity;
  intendedAction: string;
  actualResult: string;
  routePath: string;
  contextJobId?: string | null;
  contextCustomerId?: string | null;
  contextPropertyId?: string | null;
  screenshotUrl?: string | null;
}

export interface UpdateFeedbackReportInput {
  status?: FeedbackStatus;
  triageNotes?: string | null;
}
