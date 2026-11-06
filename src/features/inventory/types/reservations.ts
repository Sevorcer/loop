export type ReserveReason = "rescheduled" | "plan_changed" | "manual";

export type ReleaseReason =
  | "rescheduled"
  | "cancelled"
  | "on_hold"
  | "unscheduled"
  | "removed"
  | "plan_changed"
  | "completed"
  | "manual";

/** Why a job is not holding stock right now (derived by the database from the job and plan). */
export type ReserveBlocker = "cancelled" | "completed" | "on_hold" | "unscheduled" | "plan_changed";

export interface ReserveLineResult {
  lineId: string;
  required: number;
  reserved: number;
  pulled: number;
}

export interface ReserveResult {
  released: number;
  reserved: number;
  /** False when the job cannot hold stock; every active claim was released. */
  holding: boolean;
  blocker: string | null;
  lines: ReserveLineResult[];
}
