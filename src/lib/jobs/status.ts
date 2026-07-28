export type CanonicalJobStatus =
  | "Scheduled"
  | "In Progress"
  | "On Hold"
  | "Completed"
  | "Cancelled";

const NORMALIZED_STATUS_MAP: Record<string, CanonicalJobStatus> = {
  scheduled: "Scheduled",
  "in progress": "In Progress",
  "on hold": "On Hold",
  "waiting on parts": "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
  canceled: "Cancelled",
};

export const STATUS_QUERY_VARIANTS: Record<CanonicalJobStatus, readonly string[]> = {
  Scheduled: ["Scheduled", "scheduled"],
  "In Progress": ["In Progress", "in_progress", "in progress"],
  "On Hold": ["On Hold", "on_hold", "on hold", "Waiting on Parts", "waiting_on_parts", "waiting on parts"],
  Completed: ["Completed", "completed"],
  Cancelled: ["Cancelled", "cancelled", "Canceled", "canceled"],
};

const OPEN_STATUS_EXCLUSIONS = new Set<CanonicalJobStatus>(["Completed", "Cancelled"]);

function normalizeKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

export function normalizeJobStatus(raw: string | null | undefined): CanonicalJobStatus | null {
  if (!raw) return null;
  return NORMALIZED_STATUS_MAP[normalizeKey(raw)] ?? null;
}

export function getStatusVariants(statuses: readonly CanonicalJobStatus[]): string[] {
  return Array.from(
    new Set(statuses.flatMap((status) => STATUS_QUERY_VARIANTS[status])),
  );
}

export function isOpenStatus(raw: string | null | undefined): boolean {
  const normalized = normalizeJobStatus(raw);
  return normalized !== null && !OPEN_STATUS_EXCLUSIONS.has(normalized);
}

export const OPEN_JOB_STATUS_EXCLUSION_FILTER = "(Completed,completed,Cancelled,cancelled,Canceled,canceled)";
