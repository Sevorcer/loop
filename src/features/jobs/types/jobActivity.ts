export type JobActivityType =
  | "created"
  | "scheduled"
  | "assigned"
  | "status"
  | "note";

export interface JobActivity {
  id: string;
  jobId: string;
  type: JobActivityType;
  title: string;
  description: string;
  timestamp: string;
}