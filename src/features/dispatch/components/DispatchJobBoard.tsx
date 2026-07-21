"use client";

import { useCallback, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";

import { useCurrentRole } from "@/features/auth";
import { requestJson } from "@/lib/api/client";
import type { Job, JobStatus } from "@/features/jobs/types/job";

import { DispatchJobCard } from "./DispatchJobCard";

// ---------------------------------------------------------------------------
// Board group definitions — mapped to live job statuses
// ---------------------------------------------------------------------------

const BOARD_GROUPS: {
  key: "active" | "ready" | "scheduled" | "blocked";
  label: string;
  emptyMessage: string;
  statuses: JobStatus[];
}[] = [
  {
    key: "active",
    label: "In Progress",
    emptyMessage: "No jobs currently in progress.",
    statuses: ["In Progress"],
  },
  {
    key: "scheduled",
    label: "Scheduled",
    emptyMessage: "No jobs currently scheduled.",
    statuses: ["Scheduled"],
  },
  {
    key: "blocked",
    label: "On Hold",
    emptyMessage: "No jobs waiting on conditions.",
    statuses: ["On Hold"],
  },
  {
    key: "ready",
    label: "Needs Scheduling",
    emptyMessage: "All jobs have been assigned and scheduled.",
    statuses: [],
  },
];

function BoardGroupIcon({
  groupKey,
}: {
  groupKey: "active" | "ready" | "scheduled" | "blocked";
}) {
  switch (groupKey) {
    case "active":
      return <Clock className="h-4 w-4 text-violet-400" />;
    case "ready":
      return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
    case "scheduled":
      return <CalendarDays className="h-4 w-4 text-blue-400" />;
    case "blocked":
      return <XCircle className="h-4 w-4 text-amber-400" />;
  }
}

// Pre-computed set of statuses that belong to explicit board groups.
// Used by the "ready" group to capture any jobs that don't fall into a named group.
const EXPLICIT_STATUSES = new Set<JobStatus>(
  BOARD_GROUPS.flatMap((g) => g.statuses)
);

// ---------------------------------------------------------------------------
// DispatchJobBoard
// ---------------------------------------------------------------------------

interface DispatchJobBoardProps {
  initialJobs: Job[];
}

export function DispatchJobBoard({ initialJobs }: DispatchJobBoardProps) {
  const { role } = useCurrentRole();
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());

  const handleStatusChange = useCallback(
    async (jobId: string, newStatus: JobStatus) => {
      if (!role) return;

      // Snapshot current state for rollback before applying optimistic update
      const snapshot = jobs;
      setJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, status: newStatus } : j))
      );
      setUpdatingIds((prev) => new Set(prev).add(jobId));

      try {
        await requestJson(`/api/jobs/${jobId}`, {
          role,
          method: "PATCH",
          body: { action: "status", status: newStatus },
        });
      } catch {
        // Revert to the snapshot taken before the optimistic update
        setJobs(snapshot);
      } finally {
        setUpdatingIds((prev) => {
          const next = new Set(prev);
          next.delete(jobId);
          return next;
        });
      }
    },
    [role, jobs]
  );

  // Group jobs that aren't completed or cancelled
  const activeJobs = jobs.filter(
    (j) => j.status !== "Completed" && j.status !== "Cancelled"
  );

  return (
    <div className="space-y-6">
      {BOARD_GROUPS.map((group) => {
        const groupJobs =
          group.statuses.length > 0
            ? activeJobs.filter((j) => group.statuses.includes(j.status))
            : activeJobs.filter((j) => !EXPLICIT_STATUSES.has(j.status));

        return (
          <div key={group.key}>
            <div className="mb-3 flex items-center gap-2">
              <BoardGroupIcon groupKey={group.key} />
              <h4 className="text-sm font-semibold text-slate-300">{group.label}</h4>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-xs text-slate-500">
                {groupJobs.length}
              </span>
              {group.key === "blocked" && groupJobs.length > 0 && (
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
              )}
            </div>

            {groupJobs.length === 0 ? (
              <div className="rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-5 text-sm text-slate-600">
                {group.emptyMessage}
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {groupJobs.map((job) => (
                  <DispatchJobCard
                    key={job.id}
                    job={job}
                    onStatusChange={handleStatusChange}
                    isUpdating={updatingIds.has(job.id)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
