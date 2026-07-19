export type JobType = "Install" | "Service" | "Maintenance" | "Inspection";

export type JobStatus =
  | "Scheduled"
  | "In Progress"
  | "On Hold"
  | "Completed"
  | "Cancelled";

export type JobPriority = "Low" | "Medium" | "High";

export interface Job {
  id: string;
  jobNumber: string;
  title: string;
  type: JobType;
  status: JobStatus;
  priority: JobPriority;
  customerName: string;
  propertyName: string;
  assignedTo: string;
  scheduledFor: string;
  summary: string;
  location: string;
  notes: string;
}