import { mockJobs } from "@/features/jobs/data/mockJobs";
import type { Job } from "@/features/jobs/types/job";
import {
  applySort,
  isFilterMatch,
  paginateItems,
  type CrudRepository,
  type RepositoryQuery,
} from "@/lib/repositories/contracts";

export type JobsRepositoryErrorCode = "NOT_FOUND" | "INVALID_INPUT";

export type JobsFilterField =
  | "status"
  | "type"
  | "priority"
  | "assignedTo"
  | "customerName";

export type JobsSortField = "scheduledFor" | "priority" | "status" | "title";

export type JobsListQuery = RepositoryQuery<JobsFilterField, JobsSortField>;

export type JobWriteInput = Partial<Job>;

export type JobsRepository = CrudRepository<
  Job,
  JobWriteInput,
  JobWriteInput,
  JobsFilterField,
  JobsSortField,
  JobsRepositoryErrorCode
>;

const fallbackJob: Job = {
  id: "job-template",
  jobNumber: "JOB-TEMPLATE",
  title: "Template job",
  type: "Service",
  status: "Scheduled",
  priority: "Medium",
  customerName: "Unknown customer",
  propertyName: "Unknown property",
  assignedTo: "",
  scheduledFor: new Date().toISOString().slice(0, 10),
  summary: "",
  location: "",
  notes: "",
};

export const jobsRepository: JobsRepository = {
  async list(query) {
    const filtered = mockJobs.filter((job) => isFilterMatch(job, query?.filters));
    const sorted = applySort(filtered, query?.sort);

    return {
      ok: true,
      data: paginateItems(sorted, query?.pagination),
    };
  },

  async getById(id) {
    const job = mockJobs.find((item) => item.id === id);

    if (!job) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: `Job '${id}' not found.`,
        },
      };
    }

    return { ok: true, data: job };
  },

  async create(input) {
    return {
      ok: true,
      data: {
        ...fallbackJob,
        ...input,
        id: input.id ?? crypto.randomUUID(),
      },
    };
  },

  async update(id, input) {
    const existing = mockJobs.find((item) => item.id === id);
    if (!existing) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: `Job '${id}' not found.`,
        },
      };
    }

    return {
      ok: true,
      data: { ...existing, ...input, id },
    };
  },

  async delete(id) {
    return {
      ok: true,
      data: { id },
    };
  },
};
