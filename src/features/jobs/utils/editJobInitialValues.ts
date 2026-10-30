import type { JobPriority, JobType } from "../types/job";

/**
 * Identity fields copied onto the edit-job form.
 * Customer and property ids must travel with the names. Without them, Save
 * tries to create a new customer or property and the technician's edit is lost.
 */

export interface EditJobIdentitySource {
  estimateId?: string;
  equipmentBundleId?: string;
  title: string;
  customerName: string;
  customerId?: string | null;
  propertyName: string;
  propertyId?: string | null;
  assignedTo: string;
  assignees?: Array<{ id: string }> | null;
  type: JobType;
  priority: JobPriority;
  location: string;
  summary: string;
  notes: string;
}

export function editJobIdentityValues(job: EditJobIdentitySource) {
  return {
    estimateId: job.estimateId,
    equipmentBundleId: job.equipmentBundleId,
    title: job.title,
    customerName: job.customerName,
    customerId: job.customerId,
    propertyName: job.propertyName,
    propertyId: job.propertyId,
    assignedTo: job.assignedTo,
    assigneeIds: (job.assignees ?? []).map((assignee) => assignee.id),
    type: job.type,
    priority: job.priority,
    location: job.location,
    summary: job.summary,
    notes: job.notes,
  };
}
