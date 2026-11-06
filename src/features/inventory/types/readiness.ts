// Material readiness (Inventory Lane 4, plan §3.3). Advisory only: nothing here
// ever changes a job's status or blocks scheduling.

export type MaterialReadinessLevel = "ok" | "arriving_in_time" | "short" | "at_risk";

export const MATERIAL_READINESS_LEVELS: readonly MaterialReadinessLevel[] = [
  "ok",
  "arriving_in_time",
  "short",
  "at_risk",
];

export interface ReadinessSettings {
  /** A shortfall with nothing on order is "at risk" once the job is this close. */
  leadDays: number;
  /** An arrival must land this many days before the job to count. */
  bufferDays: number;
}

export const DEFAULT_READINESS_SETTINGS: ReadinessSettings = { leadDays: 3, bufferDays: 1 };

export interface ReadinessLineInput {
  lineId: string;
  name: string;
  /** NULL = needs SKU: the line cannot be checked. */
  itemId: string | null;
  required: number;
  /** Active reservations only. */
  reserved: number;
  pulled: number;
  isOptional: boolean;
  /** Set when the office said this is not a stocked item. */
  nonStockReason: string | null;
  /** False for service / non-stock catalog items. */
  itemStockable: boolean;
}

export interface ReadinessJobInput {
  jobId: string;
  /** Scheduled start date, "YYYY-MM-DD" in the company time zone. NULL = not scheduled. */
  scheduledDate: string | null;
  /** Only Scheduled / In Progress jobs are checked. */
  active: boolean;
  lines: ReadinessLineInput[];
}

export interface ExpectedArrivalInput {
  id: string;
  itemId: string;
  qty: number;
  etaDate: string;
  /** A special order claimed by one job. */
  forJobId: string | null;
}

export interface ReadinessInput {
  /** Today in the company time zone, "YYYY-MM-DD". */
  today: string;
  settings: ReadinessSettings;
  jobs: ReadinessJobInput[];
  arrivals: ExpectedArrivalInput[];
  /** Shop stock that is on hand and not claimed, by item. */
  freeStock: Record<string, number>;
}

export interface LineReadiness {
  lineId: string;
  /** NULL when the line is excluded or cannot be checked. */
  state: MaterialReadinessLevel | null;
  reason: string | null;
  eta: string | null;
  shortfall: number;
  /** Needs SKU: reported, but not a fifth state. */
  unverified: boolean;
  /** Optional, not-stock or non-stockable lines are never checked. */
  excluded: boolean;
}

export interface JobReadiness {
  jobId: string;
  /** NULL when the job is not scheduled or not active. */
  rollup: MaterialReadinessLevel | null;
  reason: string | null;
  eta: string | null;
  lines: LineReadiness[];
  counts: {
    total: number;
    ok: number;
    arriving: number;
    short: number;
    atRisk: number;
    needsSku: number;
  };
}
