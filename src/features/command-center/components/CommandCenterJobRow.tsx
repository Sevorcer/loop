import Link from "next/link";

import { StatusBadge } from "@/components/atlas";
import { ROUTE_BUILDERS } from "@/lib/routes";
import type { Job } from "@/features/jobs/types/job";
import { formatScheduledDate } from "../utils/commandCenterUtils";

interface CommandCenterJobRowProps {
  job: Job;
  /** Extra badge content shown to the right of status, e.g. reason labels. */
  badges?: React.ReactNode;
}

const STATUS_VARIANT: Record<
  string,
  "success" | "warning" | "danger" | "info" | "neutral"
> = {
  Scheduled: "info",
  "In Progress": "warning",
  "On Hold": "danger",
  Completed: "success",
  Cancelled: "neutral",
};

const PRIORITY_DOT: Record<string, string> = {
  High: "bg-danger",
  Medium: "bg-warning",
  Low: "bg-success",
};

export function CommandCenterJobRow({ job, badges }: CommandCenterJobRowProps) {
  const statusVariant = STATUS_VARIANT[job.status] ?? "neutral";
  const priorityDot = PRIORITY_DOT[job.priority];

  return (
    <Link
      href={ROUTE_BUILDERS.JOB_DETAIL(job.id)}
      className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-elevated"
    >
      {/* Priority indicator */}
      <span
        className={[
          "h-1.5 w-1.5 shrink-0 rounded-full",
          priorityDot ?? "bg-border",
        ].join(" ")}
        aria-hidden="true"
      />

      {/* Job number */}
      <span className="w-20 shrink-0 text-xs font-mono text-muted">
        {job.jobNumber}
      </span>

      {/* Title + customer */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-primary group-hover:text-white">
          {job.title}
        </p>
        <p className="truncate text-xs text-muted">{job.customerName}</p>
      </div>

      {/* Status + extra badges */}
      <div className="flex shrink-0 items-center gap-1.5">
        <StatusBadge variant={statusVariant}>{job.status}</StatusBadge>
        {badges}
      </div>

      {/* Assigned tech */}
      <span className="hidden w-28 shrink-0 truncate text-right text-xs text-muted sm:block">
        {job.assignedTo?.trim() || (
          <span className="text-danger">Unassigned</span>
        )}
      </span>

      {/* Scheduled date */}
      <span className="hidden w-16 shrink-0 text-right text-xs text-muted md:block">
        {formatScheduledDate(job.scheduledFor)}
      </span>
    </Link>
  );
}
