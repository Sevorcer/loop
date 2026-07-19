export type JobType = "Install" | "Service" | "Maintenance" | "Inspection";
export type JobPriority = "Low" | "Medium" | "High";
export type JobStatus = "Scheduled" | "In Progress" | "On Hold" | "Completed";

export type JobActivityType = "created" | "updated" | "status" | "note";

export interface JobActivity {
  id: string;
  type: JobActivityType;
  title: string;
  description: string;
  createdAt: string;
}

export interface Job {
  id: string;
  title: string;
  customerName: string;
  propertyName: string;
  assignedTo: string;
  scheduledFor: string;
  type: JobType;
  priority: JobPriority;
  status: JobStatus;
  location: string;
  summary: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  activities: JobActivity[];
}

export type JobInput = Pick<
  Job,
  | "title"
  | "customerName"
  | "propertyName"
  | "assignedTo"
  | "scheduledFor"
  | "type"
  | "priority"
  | "location"
  | "summary"
  | "notes"
>;
