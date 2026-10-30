import type { CreateJobInput } from "@/features/jobs/types/jobStore";
import type { JobPriority } from "@/features/jobs/types/job";

const CALLBACK_ROLES = new Set(["owner", "manager", "office", "dispatch"]);
const MAX_REASON_LENGTH = 500;

export function canCreateCallback(role: string | null | undefined): boolean {
  return CALLBACK_ROLES.has(role ?? "");
}

export function isCallbackJob(type: string | null | undefined): boolean {
  return type === "Callback";
}

export function jobTypeFilterLabel(type: string): string {
  return type === "Callback" ? "Callback (return visit)" : type;
}

export function callbackReasonError(reason: string): string | null {
  const trimmed = reason.trim();
  if (!trimmed) return "Enter the reason for the return visit.";
  if (trimmed.length > MAX_REASON_LENGTH) return "Keep the reason under 500 characters.";
  return null;
}

export interface CallbackSourceJob {
  id: string;
  jobNumber: string;
  title: string;
  customerId?: string | null;
  customerName: string;
  propertyId?: string | null;
  propertyName: string;
  assignedTo: string;
  assigneeIds?: string[];
  estimateId?: string;
  equipmentBundleId?: string;
  contractorIds?: string[];
  location: string;
  summary: string;
  priority: JobPriority;
}

/**
 * A return visit keeps the customer, property, and equipment from the
 * original job, and is marked Callback with the reason the office entered.
 */
export function buildCallbackJobInput(
  original: CallbackSourceJob,
  request: { reason: string; scheduledStartAt?: string | null },
): CreateJobInput {
  const reason = request.reason.trim();
  const title = original.title.trim().toLowerCase().startsWith("callback:")
    ? original.title.trim()
    : `Callback: ${original.title.trim()}`;

  return {
    title,
    customerId: original.customerId ?? null,
    customerName: original.customerName,
    propertyId: original.propertyId ?? null,
    propertyName: original.propertyName,
    assignedTo: original.assignedTo.trim() || "Unassigned",
    assigneeIds: original.assigneeIds,
    estimateId: original.estimateId,
    equipmentBundleId: original.equipmentBundleId,
    contractorIds: original.contractorIds,
    type: "Callback",
    priority: original.priority,
    location: original.location,
    summary: `Return visit for ${original.jobNumber}. ${reason}`,
    notes: reason,
    scheduledStartAt: request.scheduledStartAt ?? null,
    scheduledEndAt: null,
    arrivalWindowStartAt: null,
    arrivalWindowEndAt: null,
  };
}
