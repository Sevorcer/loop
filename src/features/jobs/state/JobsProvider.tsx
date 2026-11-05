"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useCurrentRole } from "@/features/auth";
import { requestJson } from "@/lib/api/client";

import type { Job, JobStatus } from "../types/job";
import type { JobActivity } from "../types/jobActivity";
import type { CreateJobInput, JobsStoreValue, UpdateJobInput } from "../types/jobStore";
import { validateAssignment } from "../utils/assignmentUtils";
import { sortJobActivity } from "../utils/jobWorkspace";

const JobsContext = createContext<JobsStoreValue | null>(null);

export function JobsProvider({ children }: { children: ReactNode }) {
  const { role } = useCurrentRole();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activity, setActivity] = useState<JobActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The full workspace list (every job + recent activity) is loaded ONLY when
  // a screen that needs it asks for it via useJobsList(). The jobs layout
  // wraps the Jobs board, job detail, new/edit job and the calendar; none of
  // those render the full list, and fetching it on every visit (15 sequential
  // page reads + assignee lookups per page) was the main reason the Jobs
  // section felt slow (Bundle C perf pass, 2026-11-04).
  const [listRequested, setListRequested] = useState(false);
  const listRequestedRef = useRef(false);

  const refreshJobs = useCallback(async () => {
    if (!role) {
      return;
    }

    setLoading(true);
    try {
      setError(null);
      const response = await requestJson<{ jobs: Job[]; activity: JobActivity[] }>("/api/jobs", {
        role,
        cache: "no-store",
      });
      setJobs(response.jobs);
      setActivity(response.activity);
    } catch (loadError) {
      // Keep jobs already on screen. Clearing them made the stat cards
      // read 0 after a refresh failure even though the board still had work.
      setError(loadError instanceof Error ? loadError.message : "Failed to load jobs.");
    } finally {
      setLoading(false);
      setHydrated(true);
    }
  }, [role]);

  const loadJobDetails = useCallback(
    async (jobId: string) => {
      if (!role) {
        return;
      }

      try {
        setError(null);
        const response = await requestJson<{ job: Job; activity: JobActivity[] }>(
          `/api/jobs/${jobId}`,
          {
            role,
            cache: "no-store",
          },
        );

        const hydratedJob: Job = response.job;

        setJobs((current) =>
          current.some((job) => job.id === hydratedJob.id)
            ? current.map((job) => (job.id === jobId ? hydratedJob : job))
            : [hydratedJob, ...current],
        );
        setActivity((current) => {
          const remaining = current.filter((item) => item.jobId !== jobId);
          return [...sortJobActivity(response.activity), ...remaining];
        });
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load job details.");
      }
    },
    [role],
  );

  const ensureJobsLoaded = useCallback(() => {
    if (listRequestedRef.current) return;
    listRequestedRef.current = true;
    setListRequested(true);
  }, []);

  useEffect(() => {
    if (!role || !listRequested) {
      return;
    }

    queueMicrotask(() => {
      void refreshJobs();
    });
  }, [listRequested, refreshJobs, role]);

  /**
   * After a write: refresh the full list only when a screen asked for it;
   * otherwise re-read just the job that changed (job detail panels).
   */
  const refreshAfterWrite = useCallback(
    async (jobId: string) => {
      if (listRequestedRef.current) {
        await refreshJobs();
        return;
      }
      await loadJobDetails(jobId);
    },
    [loadJobDetails, refreshJobs],
  );

  const value = useMemo<JobsStoreValue>(() => {
    function getJobById(id: string) {
      return jobs.find((job) => job.id === id);
    }

    function getActivityByJobId(jobId: string) {
      return sortJobActivity(activity.filter((item) => item.jobId === jobId));
    }

    async function reload() {
      await refreshJobs();
    }

    async function createJob(input: CreateJobInput) {
      const response = await requestJson<{ job: Job }>("/api/jobs", {
        method: "POST",
        role,
        body: input,
      });

      setJobs((current) => [
        response.job,
        ...current.filter((job) => job.id !== response.job.id),
      ]);
      return response.job;
    }

    async function updateJob(jobId: string, input: UpdateJobInput) {
      const response = await requestJson<{ job: Job }>(`/api/jobs/${jobId}`, {
        method: "PATCH",
        role,
        body: input,
      });

      await refreshAfterWrite(jobId);
      return response.job;
    }

    async function updateJobStatus(jobId: string, status: JobStatus) {
      await requestJson<{ job: Job }>(`/api/jobs/${jobId}`, {
        method: "PATCH",
        role,
        body: { action: "status", status },
      });

      await refreshAfterWrite(jobId);
    }

    async function addJobNote(jobId: string, note: string) {
      await requestJson<{ job: Job }>(`/api/jobs/${jobId}`, {
        method: "PATCH",
        role,
        body: { action: "note", note },
      });

      await refreshAfterWrite(jobId);
    }

    async function assignContractor(
      jobId: string,
      contractorId: string,
    ): Promise<{ ok: true } | { ok: false; error: string }> {
      const job = jobs.find((entry) => entry.id === jobId);

      if (!job) {
        return { ok: false, error: "Job not found." };
      }

      const validation = validateAssignment(job, contractorId);

      if (!validation.valid) {
        return { ok: false, error: validation.error };
      }

      try {
        await requestJson<{ job: Job }>(`/api/jobs/${jobId}`, {
          method: "PATCH",
          role,
          body: { action: "contractor", contractorId },
        });
      } catch (requestError) {
        return {
          ok: false,
          error:
            requestError instanceof Error
              ? requestError.message
              : "Unable to assign contractor.",
        };
      }

      await refreshAfterWrite(jobId);

      return { ok: true };
    }

      async function setJobNotifications(jobId: string, enabled: boolean) {
    try {
      const response = await requestJson<{
        job: Job;
        email: { sent: boolean; reason?: string };
      }>(`/api/jobs/${jobId}`, {
        method: "PATCH",
        role,
        body: { action: "notifications", enabled },
      });
      await refreshJobs();
      return { ok: true as const, email: response.email };
    } catch (requestError) {
      return {
        ok: false as const,
        error:
          requestError instanceof Error
            ? requestError.message
            : "Unable to update customer notifications.",
      };
    }
  }

  async function markJobEnRoute(jobId: string) {
    try {
      const response = await requestJson<{
        job: Job;
        email: { sent: boolean; reason?: string };
      }>(`/api/jobs/${jobId}`, {
        method: "PATCH",
        role,
        body: { action: "en_route" },
      });
      await refreshJobs();
      return { ok: true as const, email: response.email };
    } catch (requestError) {
      return {
        ok: false as const,
        error:
          requestError instanceof Error
            ? requestError.message
            : "Unable to mark on the way.",
      };
    }
  }

  async function removeContractorAssignment(jobId: string, contractorId: string) {
      await requestJson<{ job: Job }>(`/api/jobs/${jobId}`, {
        method: "PATCH",
        role,
        body: { action: "contractor", direction: "remove", contractorId },
      });

      await refreshAfterWrite(jobId);
    }

    return {
      jobs,
      hydrated,
      loading,
      error,
      getJobById,
      getActivityByJobId,
      createJob,
      updateJob,
      updateJobStatus,
      addJobNote,
      assignContractor,
      removeContractorAssignment,
    setJobNotifications,
    markJobEnRoute,
    refreshJobs,
      loadJobDetails,
      ensureJobsLoaded,
      reload,
    };
  }, [activity, ensureJobsLoaded, error, hydrated, jobs, loadJobDetails, loading, refreshAfterWrite, refreshJobs, role]);

  return <JobsContext.Provider value={value}>{children}</JobsContext.Provider>;
}

export function useJobs() {
  const context = useContext(JobsContext);

  if (!context) {
    throw new Error("useJobs must be used within a JobsProvider");
  }

  return context;
}

/**
 * useJobs() plus a request for the FULL workspace job list. Use this only in
 * screens that genuinely render or search every job (Daily Plans, the New Job
 * technician suggestions). Everything else should read single jobs or the
 * paginated /api/jobs?page= endpoint instead.
 */
export function useJobsList() {
  const context = useJobs();
  const ensure = context.ensureJobsLoaded;
  useEffect(() => {
    ensure?.();
  }, [ensure]);
  return context;
}
