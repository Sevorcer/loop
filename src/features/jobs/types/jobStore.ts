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
  appointmentWindow?: Job["appointmentWindow"];
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
  appointmentWindow?: Job["appointmentWindow"];
  type: Job["type"];
  priority: Job["priority"];
  location: string;
  summary: string;
  notes: string;
}

export interface JobsStoreValue {
  jobs: Job[];
  hydrated: boolean;
  loading: boolean;
  error: string | null;
  getJobById: (id: string) => Job | undefined;
  getActivityByJobId: (jobId: string) => JobActivity[];
  createJob: (input: CreateJobInput) => Promise<Job>;
  updateJob: (jobId: string, input: UpdateJobInput) => Promise<Job | undefined>;
  updateJobStatus: (jobId: string, status: JobStatus) => Promise<void>;
  addJobNote: (jobId: string, note: string) => Promise<void>;
  assignContractor: (
    jobId: string,
    contractorId: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  removeContractorAssignment: (jobId: string, contractorId: string) => Promise<void>;
  refreshJobs: () => Promise<void>;
  loadJobDetails: (jobId: string) => Promise<void>;
  reload: () => Promise<void>;
}
