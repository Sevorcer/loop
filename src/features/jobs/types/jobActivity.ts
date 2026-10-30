export type JobActivityType =
  | "created"
  | "edited"
  | "scheduled"
  | "assigned"
  | "contractor"
  | "status"
  | "note"
  | "qa"
  | "file"
  | "signature";

export interface JobActivity {
  id: string;
  jobId: string;
  actorId?: string;
  type: JobActivityType;
  title: string;
  description: string;
  timestamp: string;
}