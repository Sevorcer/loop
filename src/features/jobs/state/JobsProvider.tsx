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

import { useCurrentRole } from "@/features/auth";
import { requestJson } from "@/lib/api/client";

import type { Job, JobStatus } from "../types/job";
import type { JobActivity } from "../types/jobActivity";
import type {
  CreateJobInput,
  JobsStoreValue,
  UpdateJobInput,
} from "../types/jobStore";
import { applyAssignment, removeAssignment, validateAssignment } from "../utils/assignmentUtils";

interface JobsContextValue extends JobsStoreValue {}

const JobsContext = createContext<JobsContextValue | null>(null);

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
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contractorAssignments, setContractorAssignments] = useState<Record<string, string[]>>({});

  const loadJobs = useCallback(async () => {
    if (!role) {
      return;
    }

    try {
      setError(null);
      const response = await requestJson<{ jobs: Job[]; activity: JobActivity[] }>("/api/jobs", {
        role,
        cache: "no-store",
      });
      setJobs(mergeContractorAssignments(response.jobs, contractorAssignments));
      setActivity(response.activity);
    } catch (loadError) {
      setJobs([]);
      setActivity([]);
      setError(loadError instanceof Error ? loadError.message : "Failed to load jobs.");
    } finally {
      setHydrated(true);
    }
  }, [contractorAssignments, role]);

  useEffect(() => {
    if (!role) {
      return;
    }

    void loadJobs();
  }, [loadJobs, role]);

  const value = useMemo<JobsContextValue>(() => {
    function getJobById(id: string) {
      return jobs.find((job) => job.id === id);
    }

    function getActivityByJobId(jobId: string) {
      return activity
        .filter((item) => item.jobId === jobId)
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        );
    }

    async function reload() {
      await loadJobs();
    }

    async function createJob(input: CreateJobInput) {
      const response = await requestJson<{ job: Job }>("/api/jobs", {
        method: "POST",
        role,
        body: input,
      });

      await reload();
      return response.job;
    }

    async function updateJob(jobId: string, input: UpdateJobInput) {
      const response = await requestJson<{ job: Job }>(`/api/jobs/${jobId}`, {
        method: "PATCH",
        role,
        body: input,
      });

      await reload();
      return response.job;
    }

    async function updateJobStatus(jobId: string, status: JobStatus) {
      await requestJson<{ job: Job }>(`/api/jobs/${jobId}`, {
        method: "PATCH",
        role,
        body: { action: "status", status },
      });

      await reload();
    }

    async function addJobNote(jobId: string, note: string) {
      await requestJson<{ job: Job }>(`/api/jobs/${jobId}`, {
        method: "PATCH",
        role,
        body: { action: "note", note },
      });

      await reload();
    }

    function assignContractor(
      jobId: string,
      contractorId: string,
    ): { ok: true } | { ok: false; error: string } {
      const job = jobs.find((j) => j.id === jobId);

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
      setJobs((current) =>
        current.map((item) => (item.id === jobId ? updated : item)),
      );

      return { ok: true };
    }

    function removeContractorAssignment(jobId: string, contractorId: string): void {
      const job = jobs.find((j) => j.id === jobId);

      if (!job) {
        return;
      }

      const updated = removeAssignment(job, contractorId);

      setContractorAssignments((current) => ({
        ...current,
        [jobId]: updated.contractorIds ?? [],
      }));
      setJobs((current) =>
        current.map((item) => (item.id === jobId ? updated : item)),
      );
    }

    return {
      hydrated,
      jobs,
      error,
      getJobById,
      getActivityByJobId,
      createJob,
      updateJob,
      updateJobStatus,
      addJobNote,
      assignContractor,
      removeContractorAssignment,
      reload,
    };
  }, [activity, error, hydrated, jobs, loadJobs, role]);

  return <JobsContext.Provider value={value}>{children}</JobsContext.Provider>;
}

export function useJobs() {
  const context = useContext(JobsContext);

  if (!context) {
    throw new Error("useJobs must be used within a JobsProvider");
  }

  return context;
}
