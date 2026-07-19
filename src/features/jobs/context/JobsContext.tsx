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

import { mockJobs } from "../data/mockJobs";
import type { Job, JobActivity, JobInput, JobStatus } from "../types";

const STORAGE_KEY = "loop.jobs.v1";
const editableFields: Array<keyof JobInput> = [
  "title",
  "customerName",
  "propertyName",
  "assignedTo",
  "scheduledFor",
  "type",
  "priority",
  "location",
  "summary",
  "notes",
];

type JobsContextValue = {
  jobs: Job[];
  isHydrated: boolean;
  createJob: (input: JobInput) => string;
  updateJob: (id: string, input: JobInput) => void;
  updateJobStatus: (id: string, status: JobStatus) => void;
  addJobNote: (id: string, note: string) => void;
  getJobById: (id: string) => Job | undefined;
};

const JobsContext = createContext<JobsContextValue | undefined>(undefined);

function generateId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function toSortedJobs(jobs: Job[]) {
  return [...jobs].sort((left, right) => {
    const leftDate = new Date(left.scheduledFor).getTime();
    const rightDate = new Date(right.scheduledFor).getTime();

    if (leftDate !== rightDate) {
      return leftDate - rightDate;
    }

    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
}

function createActivity(activity: Omit<JobActivity, "id">): JobActivity {
  return {
    id: generateId("activity"),
    ...activity,
  };
}

function isJob(candidate: unknown): candidate is Job {
  if (!candidate || typeof candidate !== "object") {
    return false;
  }

  const job = candidate as Partial<Job>;

  return (
    typeof job.id === "string" &&
    typeof job.title === "string" &&
    typeof job.customerName === "string" &&
    typeof job.propertyName === "string" &&
    typeof job.assignedTo === "string" &&
    typeof job.scheduledFor === "string" &&
    typeof job.type === "string" &&
    typeof job.priority === "string" &&
    typeof job.status === "string" &&
    typeof job.location === "string" &&
    typeof job.summary === "string" &&
    typeof job.notes === "string" &&
    typeof job.createdAt === "string" &&
    typeof job.updatedAt === "string" &&
    Array.isArray(job.activities)
  );
}

export function JobsProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<Job[]>(mockJobs);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const hydrate = window.setTimeout(() => {
      try {
        const storedValue = window.localStorage.getItem(STORAGE_KEY);
        if (!storedValue) {
          setIsHydrated(true);
          return;
        }

        const parsed = JSON.parse(storedValue) as unknown;
        if (Array.isArray(parsed) && parsed.every(isJob)) {
          setJobs(toSortedJobs(parsed));
        }
      } catch {
        // Ignore malformed localStorage payloads and fall back to bundled jobs.
      } finally {
        setIsHydrated(true);
      }
    }, 0);

    return () => window.clearTimeout(hydrate);
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
  }, [isHydrated, jobs]);

  const createJob = useCallback((input: JobInput) => {
    const timestamp = new Date().toISOString();
    const id = generateId("job");
    const newJob: Job = {
      id,
      ...input,
      status: "Scheduled",
      createdAt: timestamp,
      updatedAt: timestamp,
      activities: [
        createActivity({
          type: "created",
          title: "Job created",
          description: `Created for ${input.customerName} at ${input.propertyName}.`,
          createdAt: timestamp,
        }),
      ],
    };

    setJobs((current) => toSortedJobs([newJob, ...current]));
    return id;
  }, []);

  const updateJob = useCallback((id: string, input: JobInput) => {
    setJobs((current) =>
      toSortedJobs(
        current.map((job) => {
          if (job.id !== id) {
            return job;
          }

          const changedFields = editableFields.filter(
            (field) => job[field] !== input[field]
          );

          if (changedFields.length === 0) {
            return job;
          }

          const timestamp = new Date().toISOString();
          const readableFields = changedFields
            .map((field) => {
              switch (field) {
                case "customerName":
                  return "customer";
                case "propertyName":
                  return "property";
                case "assignedTo":
                  return "assignee";
                case "scheduledFor":
                  return "schedule";
                default:
                  return field;
              }
            })
            .join(", ");

          return {
            ...job,
            ...input,
            updatedAt: timestamp,
            activities: [
              createActivity({
                type: "updated",
                title: "Job updated",
                description: `Updated ${readableFields}.`,
                createdAt: timestamp,
              }),
              ...job.activities,
            ],
          };
        })
      )
    );
  }, []);

  const updateJobStatus = useCallback((id: string, status: JobStatus) => {
    setJobs((current) =>
      toSortedJobs(
        current.map((job) => {
          if (job.id !== id || job.status === status) {
            return job;
          }

          const timestamp = new Date().toISOString();

          return {
            ...job,
            status,
            updatedAt: timestamp,
            activities: [
              createActivity({
                type: "status",
                title: `Status changed to ${status}`,
                description: `Job status was updated from ${job.status} to ${status}.`,
                createdAt: timestamp,
              }),
              ...job.activities,
            ],
          };
        })
      )
    );
  }, []);

  const addJobNote = useCallback((id: string, note: string) => {
    const trimmedNote = note.trim();

    if (!trimmedNote) {
      return;
    }

    setJobs((current) =>
      toSortedJobs(
        current.map((job) => {
          if (job.id !== id) {
            return job;
          }

          const timestamp = new Date().toISOString();

          return {
            ...job,
            updatedAt: timestamp,
            activities: [
              createActivity({
                type: "note",
                title: "Note added",
                description: trimmedNote,
                createdAt: timestamp,
              }),
              ...job.activities,
            ],
          };
        })
      )
    );
  }, []);

  const getJobById = useCallback(
    (id: string) => jobs.find((job) => job.id === id),
    [jobs]
  );

  const value = useMemo(
    () => ({
      jobs,
      isHydrated,
      createJob,
      updateJob,
      updateJobStatus,
      addJobNote,
      getJobById,
    }),
    [addJobNote, createJob, getJobById, isHydrated, jobs, updateJob, updateJobStatus]
  );

  return <JobsContext.Provider value={value}>{children}</JobsContext.Provider>;
}

export function useJobs() {
  const context = useContext(JobsContext);

  if (!context) {
    throw new Error("useJobs must be used within a JobsProvider");
  }

  return context;
}
