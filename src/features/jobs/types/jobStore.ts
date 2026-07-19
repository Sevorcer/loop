import type { Job, JobStatus } from "./job";
import type { JobActivity } from "./jobActivity";

export interface CreateJobInput {
  estimateId?: string;
  equipmentBundleId?: string;
  title: string;
  customerName: string;
  propertyName: string;
  assignedTo: string;
  scheduledFor: string;
  type: Job["type"];
  priority: Job["priority"];
  location: string;
  summary: string;
  notes: string;
}

export interface UpdateJobInput {
  estimateId?: string;
  equipmentBundleId?: string;
  title: string;
  customerName: string;
  propertyName: string;
  assignedTo: string;
  scheduledFor: string;
  type: Job["type"];
  priority: Job["priority"];
  location: string;
  summary: string;
  notes: string;
}

export interface JobsStoreValue {
  jobs: Job[];
  hydrated: boolean;
  getJobById: (id: string) => Job | undefined;
  getActivityByJobId: (jobId: string) => JobActivity[];
  createJob: (input: CreateJobInput) => Job;
  updateJob: (jobId: string, input: UpdateJobInput) => Job | undefined;
  updateJobStatus: (jobId: string, status: JobStatus) => void;
  addJobNote: (jobId: string, note: string) => void;
}