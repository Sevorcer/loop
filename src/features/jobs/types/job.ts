export type JobType = "Install" | "Service" | "Maintenance" | "Inspection";

export type JobStatus =
  | "Scheduled"
  | "In Progress"
  | "On Hold"
  | "Completed"
  | "Cancelled";

export type JobPriority = "Low" | "Medium" | "High";
export type JobAppointmentWindow = "Morning" | "Afternoon";

export interface Job {
  id: string;
  jobNumber: string;
  estimateId?: string;
  equipmentBundleId?: string;
  title: string;
  type: JobType;
  status: JobStatus;
  priority: JobPriority;
  customerId?: string | null;
  customerName: string;
  propertyId?: string | null;
  propertyName: string;
  assignedTo: string;
  scheduledFor: string;
  appointmentWindow?: JobAppointmentWindow;
  summary: string;
  location: string;
  notes: string;
  contractorIds?: string[];
}