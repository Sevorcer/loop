export type JobActivityType =
  | "created"
  | "edited"
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