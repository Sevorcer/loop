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
import { applyAssignment, removeAssignment, validateAssignment } from "../utils/assignmentUtils";
import { sortJobActivity } from "../utils/jobWorkspace";

const JobsContext = createContext<JobsStoreValue | null>(null);

function mergeContractorAssignments(
  jobs: Job[],
  assignments: Record<string, string[]>,
): Job[] {
  return jobs.map((job) => ({
    ...job,
    contractorIds: assignments[job.id] ?? job.contractorIds,
  }));
}

export function JobsProvider({ children }: { children: ReactNode }) {
  const { role } = useCurrentRole();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activity, setActivity] = useState<JobActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contractorAssignments, setContractorAssignments] = useState<Record<string, string[]>>({});
  const contractorAssignmentsRef = useRef<Record<string, string[]>>({});

  useEffect(() => {
    contractorAssignmentsRef.current = contractorAssignments;
  }, [contractorAssignments]);

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
      setJobs(mergeContractorAssignments(response.jobs, contractorAssignmentsRef.current));
      setActivity(response.activity);
    } catch (loadError) {
      setJobs([]);
      setActivity([]);
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

        const hydratedJob: Job = {
          ...response.job,
          contractorIds:
            contractorAssignmentsRef.current[jobId] ?? response.job.contractorIds,
        };

        setJobs((current) =>
          current.some((job) => job.id === hydratedJob.id)
            ? current.map((job) => (job.id === hydratedJob.id ? hydratedJob : job))
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

  useEffect(() => {
    if (!role) {
      return;
    }

    queueMicrotask(() => {
      void refreshJobs();
    });
  }, [refreshJobs, role]);

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

      await refreshJobs();
      return response.job;
    }

    async function updateJob(jobId: string, input: UpdateJobInput) {
      const response = await requestJson<{ job: Job }>(`/api/jobs/${jobId}`, {
        method: "PATCH",
        role,
        body: input,
      });

      await refreshJobs();
      return response.job;
    }

    async function updateJobStatus(jobId: string, status: JobStatus) {
      await requestJson<{ job: Job }>(`/api/jobs/${jobId}`, {
        method: "PATCH",
        role,
        body: { action: "status", status },
      });

      await refreshJobs();
    }

    async function addJobNote(jobId: string, note: string) {
      await requestJson<{ job: Job }>(`/api/jobs/${jobId}`, {
        method: "PATCH",
        role,
        body: { action: "note", note },
      });

      await refreshJobs();
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

      const updated = applyAssignment(job, contractorId);

      setContractorAssignments((current) => ({
        ...current,
        [jobId]: updated.contractorIds ?? [],
      }));
      setJobs((current) => current.map((item) => (item.id === jobId ? updated : item)));

      return { ok: true };
    }

    async function removeContractorAssignment(jobId: string, contractorId: string) {
      const job = jobs.find((entry) => entry.id === jobId);

      if (!job) {
        return;
      }

      const updated = removeAssignment(job, contractorId);

      setContractorAssignments((current) => ({
        ...current,
        [jobId]: updated.contractorIds ?? [],
      }));
      setJobs((current) => current.map((item) => (item.id === jobId ? updated : item)));
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
      refreshJobs,
      loadJobDetails,
      reload,
    };
  }, [activity, error, hydrated, jobs, loadJobDetails, loading, refreshJobs, role]);

  return <JobsContext.Provider value={value}>{children}</JobsContext.Provider>;
}

export function useJobs() {
  const context = useContext(JobsContext);

  if (!context) {
    throw new Error("useJobs must be used within a JobsProvider");
  }

  return context;
}
