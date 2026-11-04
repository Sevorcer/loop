import {
  type LoopJobStatus,
  type LoopJobType,
  type LoopPriority,
  SF_CLOSED_STATUSES,
} from "./constants";
import { normalizeLabel } from "./json";

export function isSfJobClosed(status: string): boolean {
  return SF_CLOSED_STATUSES.has(normalizeLabel(status));
}

/**
 * Map a Service Fusion status onto Loop's five statuses.
 * The original text is stored separately so Paid, Invoiced, and Past Due are not lost.
 * An unrecognized status becomes On Hold and is reported.
 */
export function mapJobStatus(status: string): { status: LoopJobStatus; unknown: boolean } {
  const label = normalizeLabel(status);
  if (!label) return { status: "On Hold", unknown: true };

  if (label === "unscheduled" || label === "parts on order") {
    return { status: "On Hold", unknown: false };
  }
  if (
    label === "scheduled" ||
    label === "scheduled - service" ||
    label === "scheduled-service" ||
    label === "dispatched" ||
    label === "install" ||
    label.startsWith("install -") ||
    label.startsWith("install-")
  ) {
    return { status: "Scheduled", unknown: false };
  }
  if (label === "in route" || label === "working on site") {
    return { status: "In Progress", unknown: false };
  }
  if (
    label === "completed" ||
    label === "invoiced" ||
    label === "paid in full" ||
    label === "past due" ||
    label === "no charge" ||
    label === "warranty"
  ) {
    return { status: "Completed", unknown: false };
  }
  if (
    label === "cancelled" ||
    label === "canceled" ||
    label === "job cancelled" ||
    label === "job canceled" ||
    label === "cancelled-write off" ||
    label === "canceled-write off" ||
    label === "estimate closed"
  ) {
    return { status: "Cancelled", unknown: false };
  }

  return { status: "On Hold", unknown: true };
}

export function mapJobType(category: string): { type: LoopJobType; unknown: boolean } {
  const label = normalizeLabel(category);
  if (!label) return { type: "Service", unknown: true };
  if (label.startsWith("call back") || label.startsWith("callback")) {
    return { type: "Callback", unknown: false };
  }
  if (label.includes("maintenance")) return { type: "Maintenance", unknown: false };
  if (label.includes("diagnostic") || label.includes("scheduled repair") || label === "meeting") {
    return { type: "Service", unknown: false };
  }
  if (label.includes("site visit") || label.includes("inspection")) {
    return { type: "Inspection", unknown: false };
  }
  if (label.includes("estimate")) return { type: "Estimate", unknown: false };
  if (label === "install" || label.startsWith("install")) return { type: "Install", unknown: false };
  return { type: "Service", unknown: true };
}

export function mapPriority(priority: string): LoopPriority {
  const label = normalizeLabel(priority);
  if (label === "low") return "Low";
  if (label === "high" || label === "urgent" || label === "emergency") return "High";
  return "Medium";
}

/**
 * Derive the closeout mode from the mapped Loop job type.
 *
 * Single-visit job types (Inspection, Estimate) use "visit" closeout — the
 * tech only needs a job note to close. Multi-step work (Install, Service,
 * Maintenance, Callback) uses "full" closeout — photos, installed systems,
 * QA items, and a job note.
 */
export function closeoutModeForType(type: LoopJobType): "full" | "visit" {
  if (type === "Inspection" || type === "Estimate") return "visit";
  return "full";
}

export function sfJobNumber(number: string, prefix: string): string {
  const trimmed = number.trim();
  if (!trimmed) return "";
  if (trimmed.toLowerCase().startsWith(prefix.toLowerCase())) return trimmed;
  return `${prefix}${trimmed}`;
}
