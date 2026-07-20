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

function getDevRole() {
  if (typeof window === "undefined") {
    return "owner";
  }

  return window.localStorage.getItem("loop_dev_role") ?? "owner";
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-loop-role": getDevRole(),
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await response.json()) as T & {
    error?: string;
    message?: string;
  };

  if (!response.ok) {
    throw new Error(payload.message ?? "Request failed.");
  }

  return payload;
}

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
      const payload = await requestJson<{ jobs: Job[] }>("/api/jobs");
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
      const payload = await requestJson<{ job: Job; activity: JobActivity[] }>(
        `/api/jobs/${jobId}`
      );
      setJobs((current) =>
        current.some((job) => job.id === payload.job.id)
          ? current.map((job) => (job.id === payload.job.id ? payload.job : job))
          : [payload.job, ...current]
      );
      setActivity((current) => {
        const remaining = current.filter((item) => item.jobId !== jobId);
        return [...payload.activity, ...remaining];
      });
    } catch {
      // per-page error handling owns failures for detail fetches
    }
  }, []);

  useEffect(() => {
    void refreshJobs();
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
      const payload = await requestJson<{ job: Job }>("/api/jobs", {
        method: "POST",
        body: JSON.stringify(input),
      });

      setJobs((current) => [payload.job, ...current]);
      return payload.job;
    }

    async function updateJob(jobId: string, input: UpdateJobInput) {
      const payload = await requestJson<{ job: Job }>(`/api/jobs/${jobId}`, {
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
      await requestJson<{ job: Job }>(`/api/jobs/${jobId}`, {
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

      await requestJson<{ job: Job }>(`/api/jobs/${jobId}`, {
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
