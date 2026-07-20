"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { requestLoopApiJson } from "@/lib/loop-api-client";

import type { Job, JobStatus } from "../types/job";
import type { JobActivity } from "../types/jobActivity";
import type {
  CreateJobInput,
  JobsStoreValue,
  UpdateJobInput,
} from "../types/jobStore";
import { applyAssignment, removeAssignment, validateAssignment } from "../utils/assignmentUtils";

interface JobsContextValue extends JobsStoreValue {
  hydrated: boolean;
  loading: boolean;
  error: string | null;
  refreshJobs: () => Promise<void>;
  loadJobDetails: (jobId: string) => Promise<void>;
}

const JobsContext = createContext<JobsContextValue | null>(null);

function statusDescription(status: JobStatus) {
  return status === "In Progress"
    ? "Job moved to In Progress from the detail view."
    : status === "On Hold"
      ? "Job placed On Hold pending follow-up or issue resolution."
      : status === "Completed"
        ? "Job marked Completed from the detail view."
        : status === "Cancelled"
          ? "Job cancelled from the detail view."
          : "Job status updated from the detail view.";
}

function deriveContractorIdsFromActivity(activity: JobActivity[]) {
  const assigned = new Set<string>();

  const ordered = [...activity].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  for (const entry of ordered) {
    const assignedMatch = entry.description.match(
      /^Contractor ([\w-]+) assigned to this job\.$/
    );
    if (assignedMatch) {
      assigned.add(assignedMatch[1]);
    }

    const removedMatch = entry.description.match(
      /^Contractor ([\w-]+) removed from this job\.$/
    );
    if (removedMatch) {
      assigned.delete(removedMatch[1]);
    }
  }

  return Array.from(assigned);
}

export function JobsProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activity, setActivity] = useState<JobActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await requestLoopApiJson<{ jobs: Job[] }>("/api/jobs");
      setJobs(payload.jobs);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to load jobs.");
    } finally {
      setLoading(false);
      setHydrated(true);
    }
  }, []);

  const loadJobDetails = useCallback(async (jobId: string) => {
    try {
      const payload = await requestLoopApiJson<{
        job: Job;
        activity: JobActivity[];
      }>(
        `/api/jobs/${jobId}`
      );
      const contractorIds = deriveContractorIdsFromActivity(payload.activity);
      const hydratedJob: Job = { ...payload.job, contractorIds };
      setJobs((current) =>
        current.some((job) => job.id === hydratedJob.id)
          ? current.map((job) => (job.id === hydratedJob.id ? hydratedJob : job))
          : [hydratedJob, ...current]
      );
      setActivity((current) => {
        const remaining = current.filter((item) => item.jobId !== jobId);
        return [...payload.activity, ...remaining];
      });
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Unable to load job details."
      );
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void refreshJobs();
    });
  }, [refreshJobs]);

  const value = useMemo<JobsContextValue>(() => {
    function getJobById(id: string) {
      return jobs.find((job) => job.id === id);
    }

    function getActivityByJobId(jobId: string) {
      return activity
        .filter((item) => item.jobId === jobId)
        .sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
    }

    async function createJob(input: CreateJobInput) {
      const payload = await requestLoopApiJson<{ job: Job }>("/api/jobs", {
        method: "POST",
        body: JSON.stringify(input),
      });

      setJobs((current) => [payload.job, ...current]);
      return payload.job;
    }

    async function updateJob(jobId: string, input: UpdateJobInput) {
      const payload = await requestLoopApiJson<{ job: Job }>(`/api/jobs/${jobId}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...input,
          activity: {
            type: "edited",
            title: "Job updated",
            description: "Job details were updated from the edit form.",
          },
        }),
      });

      setJobs((current) =>
        current.map((job) => (job.id === jobId ? payload.job : job))
      );
      setActivity((current) => [
        {
          id: `activity-edit-${jobId}-${Date.now()}`,
          jobId,
          type: "edited",
          title: "Job updated",
          description: "Job details were updated from the edit form.",
          timestamp: new Date().toISOString(),
        },
        ...current,
      ]);

      return payload.job;
    }

    async function updateJobStatus(jobId: string, status: JobStatus) {
      await requestLoopApiJson<{ job: Job }>(`/api/jobs/${jobId}`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          activity: {
            type: "status",
            title: "Status updated",
            description: statusDescription(status),
          },
        }),
      });

      setJobs((current) =>
        current.map((job) => (job.id === jobId ? { ...job, status } : job))
      );
      setActivity((current) => [
        {
          id: `activity-status-${jobId}-${Date.now()}`,
          jobId,
          type: "status",
          title: "Status updated",
          description: statusDescription(status),
          timestamp: new Date().toISOString(),
        },
        ...current,
      ]);
    }

    async function addJobNote(jobId: string, note: string) {
      const job = jobs.find((entry) => entry.id === jobId);
      const mergedNotes = [job?.notes ?? "", note].filter(Boolean).join("\n\n");

      await requestLoopApiJson<{ job: Job }>(`/api/jobs/${jobId}`, {
        method: "PATCH",
        body: JSON.stringify({
          notes: mergedNotes,
          activity: {
            type: "note",
            title: "Note added",
            description: note,
          },
        }),
      });

      setJobs((current) =>
        current.map((entry) =>
          entry.id === jobId ? { ...entry, notes: mergedNotes } : entry
        )
      );

      setActivity((current) => [
        {
          id: `activity-note-${jobId}-${Date.now()}`,
          jobId,
          type: "note",
          title: "Note added",
          description: note,
          timestamp: new Date().toISOString(),
        },
        ...current,
      ]);
    }

    async function assignContractor(
      jobId: string,
      contractorId: string
    ): Promise<{ ok: true } | { ok: false; error: string }> {
      const job = jobs.find((entry) => entry.id === jobId);

      if (!job) {
        return { ok: false, error: "Job not found." };
      }

      const validation = validateAssignment(job, contractorId);

      if (!validation.valid) {
        return { ok: false, error: validation.error };
      }

      const updated = applyAssignment(job, contractorId);
      await requestLoopApiJson<{ job: Job }>(`/api/jobs/${jobId}`, {
        method: "PATCH",
        body: JSON.stringify({
          activity: {
            type: "assigned",
            title: "Contractor assigned",
            description: `Contractor ${contractorId} assigned to this job.`,
          },
        }),
      });
      setJobs((current) =>
        current.map((entry) => (entry.id === jobId ? updated : entry))
      );
      setActivity((current) => [
        {
          id: `activity-contractor-${jobId}-${Date.now()}`,
          jobId,
          type: "assigned",
          title: "Contractor assigned",
          description: `Contractor ${contractorId} assigned to this job.`,
          timestamp: new Date().toISOString(),
        },
        ...current,
      ]);

      return { ok: true };
    }

    async function removeContractorAssignment(
      jobId: string,
      contractorId: string
    ) {
      const job = jobs.find((entry) => entry.id === jobId);

      if (!job) {
        return;
      }

      const updated = removeAssignment(job, contractorId);
      await requestLoopApiJson<{ job: Job }>(`/api/jobs/${jobId}`, {
        method: "PATCH",
        body: JSON.stringify({
          activity: {
            type: "edited",
            title: "Contractor removed",
            description: `Contractor ${contractorId} removed from this job.`,
          },
        }),
      });
      setJobs((current) =>
        current.map((entry) => (entry.id === jobId ? updated : entry))
      );
      setActivity((current) => [
        {
          id: `activity-contractor-remove-${jobId}-${Date.now()}`,
          jobId,
          type: "edited",
          title: "Contractor removed",
          description: `Contractor ${contractorId} removed from this job.`,
          timestamp: new Date().toISOString(),
        },
        ...current,
      ]);
    }

    return {
      hydrated,
      loading,
      error,
      jobs,
      getJobById,
      getActivityByJobId,
      createJob,
      updateJob,
      updateJobStatus,
      addJobNote,
      assignContractor,
      removeContractorAssignment,
      refreshJobs,
      loadJobDetails,
    };
  }, [activity, error, hydrated, jobs, loading, loadJobDetails, refreshJobs]);

  return <JobsContext.Provider value={value}>{children}</JobsContext.Provider>;
}

export function useJobs() {
  const context = useContext(JobsContext);

  if (!context) {
    throw new Error("useJobs must be used within a JobsProvider");
  }

  return context;
}
