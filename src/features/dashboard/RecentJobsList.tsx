"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AlertCircle, ArrowRight, Briefcase, Loader2 } from "lucide-react";

import { ROUTES } from "@/lib/routes";
import { useCurrentRole } from "@/features/auth";
import { requestJson } from "@/lib/api/client";
import { normalizeJobStatus } from "@/lib/jobs/status";
import type { Job } from "@/features/jobs/types/job";

const RECENT_LIMIT = 5;

function getStatusColor(status: string) {
  switch (normalizeJobStatus(status) ?? status) {
    case "In Progress":
      return "bg-amber-500/15 text-amber-300";
    case "Scheduled":
      return "bg-blue-500/15 text-blue-300";
    case "Completed":
      return "completed-tint";
    case "On Hold":
      return "bg-slate-500/15 text-slate-400";
    case "Cancelled":
      return "bg-red-500/15 text-red-400";
    default:
      return "bg-slate-500/15 text-slate-400";
  }
}

export function RecentJobsList() {
  const { role } = useCurrentRole();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

  const loadRecentJobs = useCallback(async () => {
    if (!role) {
      return;
    }

    setStatus(() => "loading");
    try {
      const response = await requestJson<{ jobs: Job[] }>(
        `/api/jobs/recent?limit=${RECENT_LIMIT}`,
        { role, cache: "no-store" },
      );
      setJobs(() => response.jobs);
      setStatus(() => "ready");
    } catch {
      setStatus(() => "error");
    }
  }, [role]);

  useEffect(() => {
    void loadRecentJobs();
  }, [loadRecentJobs]);

  // Distinct loading state — previously the widget showed the empty state
  // while the full-workspace request was still in flight (or timing out).
  if (status === "loading") {
    return (
      <div
        role="status"
        aria-label="Loading recent jobs"
        className="text-muted flex items-center justify-center gap-2 px-6 py-8 text-sm"
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        <span>Loading recent jobs…</span>
      </div>
    );
  }

  // Distinct error state — a failed/timed-out read no longer masquerades as
  // "no jobs yet".
  if (status === "error") {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-8 text-center text-sm">
        <span className="text-muted inline-flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-400" aria-hidden="true" />
          Couldn’t load recent jobs.
        </span>
        <button
          type="button"
          onClick={() => void loadRecentJobs()}
          className="text-blue-400 hover:underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="text-muted px-6 py-8 text-center text-sm">
        No jobs yet.{" "}
        <Link
          href={`${ROUTES.JOBS}/new`}
          className="text-blue-400 hover:underline"
        >
          Create your first job
        </Link>
        .
      </div>
    );
  }

  return (
    <div>
      {jobs.map((job) => (
        <Link
          key={job.id}
          href={`${ROUTES.JOBS}/${job.id}`}
          className="group flex items-center justify-between border-b border-default px-4 py-3 transition-colors last:border-0 hover:bg-surface-elevated sm:px-6"
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-default bg-surface-elevated">
              <Briefcase className="text-muted h-3.5 w-3.5" />
            </div>

            <div className="overflow-hidden">
              <p className="text-primary truncate text-sm font-medium">
                {job.title}
              </p>
              <p className="text-muted mt-0.5 truncate text-xs">
                {job.jobNumber} · {job.propertyName}
              </p>
            </div>
          </div>

          <div className="ml-3 flex shrink-0 items-center gap-2">
            <span
              className={`hidden rounded-full px-2 py-0.5 text-xs font-semibold sm:inline-flex ${getStatusColor(job.status)}`}
            >
              {normalizeJobStatus(job.status) ?? job.status}
            </span>
            <ArrowRight className="text-muted h-4 w-4 transition-colors" />
          </div>
        </Link>
      ))}

      <div className="border-t border-default px-4 py-3 sm:px-6">
        <Link
          href={ROUTES.JOBS}
          className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300"
        >
          View all jobs
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
