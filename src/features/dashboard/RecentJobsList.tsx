"use client";

import Link from "next/link";
import { ArrowRight, Briefcase } from "lucide-react";

import { ROUTES } from "@/lib/routes";
import { useJobs } from "@/features/jobs/state/JobsProvider";
import { normalizeJobStatus } from "@/lib/jobs/status";

function getStatusColor(status: string) {
  switch (normalizeJobStatus(status) ?? status) {
    case "In Progress":
      return "bg-amber-500/15 text-amber-300";
    case "Scheduled":
      return "bg-blue-500/15 text-blue-300";
    case "Completed":
      return "bg-emerald-500/15 text-emerald-300";
    case "On Hold":
      return "bg-slate-500/15 text-slate-400";
    case "Cancelled":
      return "bg-red-500/15 text-red-400";
    default:
      return "bg-slate-500/15 text-slate-400";
  }
}

export function RecentJobsList() {
  const { jobs } = useJobs();

  const recent = jobs.slice(0, 5);

  if (recent.length === 0) {
    return (
      <div className="px-6 py-8 text-center text-sm text-slate-500">
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
      {recent.map((job) => (
        <Link
          key={job.id}
          href={`${ROUTES.JOBS}/${job.id}`}
          className="group flex items-center justify-between border-b border-white/5 px-4 py-3 last:border-0 transition-colors hover:bg-white/[0.03] sm:px-6"
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] ring-1 ring-white/10">
              <Briefcase className="h-3.5 w-3.5 text-slate-400" />
            </div>

            <div className="overflow-hidden">
              <p className="truncate text-sm font-medium text-slate-200">
                {job.title}
              </p>
              <p className="mt-0.5 truncate text-xs text-slate-500">
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
            <ArrowRight className="h-4 w-4 text-slate-600 transition-colors group-hover:text-slate-400" />
          </div>
        </Link>
      ))}

      <div className="border-t border-white/10 px-4 py-3 sm:px-6">
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
