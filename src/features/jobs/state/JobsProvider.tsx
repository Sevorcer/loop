"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { mockJobActivity } from "../data/mockJobActivity";
import { mockJobs } from "../data/mockJobs";
import type { Job, JobStatus } from "../types/job";
import type { JobActivity } from "../types/jobActivity";
import type {
  CreateJobInput,
  JobsStoreValue,
  UpdateJobInput,
} from "../types/jobStore";

interface JobsContextValue extends JobsStoreValue {
  hydrated: boolean;
}

const JobsContext = createContext<JobsContextValue | null>(null);

const JOBS_STORAGE_KEY = "loop.jobs.items";
const JOB_ACTIVITY_STORAGE_KEY = "loop.jobs.activity";

function createJobNumber(index: number) {
  return `JOB-${1000 + index}`;
}

function createJobId(index: number) {
  return `job-${String(index).padStart(3, "0")}`;
}

function parseStoredValue<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function JobsProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<Job[]>(() => {
    if (typeof window === "undefined") {
      return mockJobs;
    }

    return parseStoredValue<Job[]>(
      window.localStorage.getItem(JOBS_STORAGE_KEY),
      mockJobs
    );
  });
  const [activity, setActivity] = useState<JobActivity[]>(() => {
    if (typeof window === "undefined") {
      return mockJobActivity;
    }

    return parseStoredValue<JobActivity[]>(
      window.localStorage.getItem(JOB_ACTIVITY_STORAGE_KEY),
      mockJobActivity
    );
  });
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    window.localStorage.setItem(JOBS_STORAGE_KEY, JSON.stringify(jobs));
  }, [hydrated, jobs]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    window.localStorage.setItem(
      JOB_ACTIVITY_STORAGE_KEY,
      JSON.stringify(activity)
    );
  }, [activity, hydrated]);

  const value = useMemo<JobsContextValue>(() => {
    function getJobById(id: string) {
      return jobs.find((job) => job.id === id);
    }

    function getActivityByJobId(jobId: string) {
      return activity
        .filter((item) => item.jobId === jobId)
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
    }

    function createJob(input: CreateJobInput) {
      const nextIndex = jobs.length + 1;
      const timestamp = new Date().toISOString();

      const newJob: Job = {
        id: createJobId(nextIndex),
        jobNumber: createJobNumber(nextIndex),
        title: input.title,
        type: input.type,
        status: "Scheduled",
        priority: input.priority,
        customerName: input.customerName,
        propertyName: input.propertyName,
        assignedTo: input.assignedTo,
        scheduledFor: input.scheduledFor,
        summary: input.summary,
        location: input.location,
        notes: input.notes,
      };

      const createdActivity: JobActivity = {
        id: `activity-created-${newJob.id}-${Date.now()}`,
        jobId: newJob.id,
        type: "created",
        title: "Job created",
        description: `New ${newJob.type.toLowerCase()} job created from the job form.`,
        timestamp,
      };

      const assignedActivity: JobActivity = {
        id: `activity-assigned-${newJob.id}-${Date.now() + 1}`,
        jobId: newJob.id,
        type: "assigned",
        title: "Technician assigned",
        description: `${newJob.assignedTo} assigned to this job.`,
        timestamp,
      };

      const scheduledActivity: JobActivity = {
        id: `activity-scheduled-${newJob.id}-${Date.now() + 2}`,
        jobId: newJob.id,
        type: "scheduled",
        title: "Schedule confirmed",
        description: `Job scheduled for ${new Date(
          newJob.scheduledFor
        ).toLocaleDateString()}.`,
        timestamp,
      };

      setJobs((current) => [newJob, ...current]);
      setActivity((current) => [
        scheduledActivity,
        assignedActivity,
        createdActivity,
        ...current,
      ]);

      return newJob;
    }

    function updateJob(jobId: string, input: UpdateJobInput) {
      const existingJob = jobs.find((job) => job.id === jobId);

      if (!existingJob) {
        return undefined;
      }

      const updatedJob: Job = {
        ...existingJob,
        title: input.title,
        customerName: input.customerName,
        propertyName: input.propertyName,
        assignedTo: input.assignedTo,
        scheduledFor: input.scheduledFor,
        type: input.type,
        priority: input.priority,
        location: input.location,
        summary: input.summary,
        notes: input.notes,
      };

      setJobs((current) =>
        current.map((job) => (job.id === jobId ? updatedJob : job))
      );

      const changedFields: string[] = [];

      if (existingJob.title !== updatedJob.title) changedFields.push("title");
      if (existingJob.customerName !== updatedJob.customerName) {
        changedFields.push("customer");
      }
      if (existingJob.propertyName !== updatedJob.propertyName) {
        changedFields.push("property");
      }
      if (existingJob.assignedTo !== updatedJob.assignedTo) {
        changedFields.push("assignee");
      }
      if (existingJob.scheduledFor !== updatedJob.scheduledFor) {
        changedFields.push("schedule");
      }
      if (existingJob.type !== updatedJob.type) changedFields.push("type");
      if (existingJob.priority !== updatedJob.priority) {
        changedFields.push("priority");
      }
      if (existingJob.location !== updatedJob.location) {
        changedFields.push("location");
      }
      if (existingJob.summary !== updatedJob.summary) {
        changedFields.push("summary");
      }
      if (existingJob.notes !== updatedJob.notes) changedFields.push("notes");

      const editActivity: JobActivity = {
        id: `activity-edit-${jobId}-${Date.now()}`,
        jobId,
        type: "edited",
        title: "Job updated",
        description:
          changedFields.length === 0
            ? "Job details were saved with no field changes."
            : `Updated fields: ${changedFields.join(", ")}.`,
        timestamp: new Date().toISOString(),
      };

      setActivity((current) => [editActivity, ...current]);

      return updatedJob;
    }

    function updateJobStatus(jobId: string, status: JobStatus) {
      setJobs((current) =>
        current.map((job) => (job.id === jobId ? { ...job, status } : job))
      );

      const description =
        status === "In Progress"
          ? "Job moved to In Progress from the detail view."
          : status === "On Hold"
            ? "Job placed On Hold pending follow-up or issue resolution."
            : status === "Completed"
              ? "Job marked Completed from the detail view."
              : status === "Cancelled"
                ? "Job cancelled from the detail view."
                : "Job status updated from the detail view.";

      const statusActivity: JobActivity = {
        id: `activity-status-${jobId}-${Date.now()}`,
        jobId,
        type: "status",
        title: "Status updated",
        description,
        timestamp: new Date().toISOString(),
      };

      setActivity((current) => [statusActivity, ...current]);
    }

    function addJobNote(jobId: string, note: string) {
      const noteActivity: JobActivity = {
        id: `activity-note-${jobId}-${Date.now()}`,
        jobId,
        type: "note",
        title: "Note added",
        description: note,
        timestamp: new Date().toISOString(),
      };

      setActivity((current) => [noteActivity, ...current]);
    }

    return {
      hydrated,
      jobs,
      getJobById,
      getActivityByJobId,
      createJob,
      updateJob,
      updateJobStatus,
      addJobNote,
    };
  }, [activity, hydrated, jobs]);

  return <JobsContext.Provider value={value}>{children}</JobsContext.Provider>;
}

export function useJobs() {
  const context = useContext(JobsContext);

  if (!context) {
    throw new Error("useJobs must be used within a JobsProvider");
  }

  return context;
}