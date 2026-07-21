"use client";

import {
  AlertTriangle,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Clock,
  MapPin,
  Play,
  PauseCircle,
  User,
} from "lucide-react";
import Link from "next/link";

import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";
import type { Job, JobStatus } from "@/features/jobs/types/job";

interface DispatchJobCardProps {
  job: Job;
  onStatusChange: (jobId: string, status: JobStatus) => void;
  isUpdating?: boolean;
}

const statusVariant: Record<
  JobStatus,
  { badge: string; icon: string }
> = {
  Scheduled: {
    badge: "border-blue-500/20 bg-blue-500/10 text-blue-300",
    icon: "text-blue-400",
  },
  "In Progress": {
    badge: "border-violet-500/20 bg-violet-500/10 text-violet-300",
    icon: "text-violet-400",
  },
  "On Hold": {
    badge: "border-amber-500/20 bg-amber-500/10 text-amber-300",
    icon: "text-amber-400",
  },
  Completed: {
    badge: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    icon: "text-emerald-400",
  },
  Cancelled: {
    badge: "border-slate-700 bg-white/5 text-slate-400",
    icon: "text-slate-500",
  },
};

const priorityVariant: Record<
  Job["priority"],
  string
> = {
  High: "border-red-500/20 bg-red-500/10 text-red-300",
  Medium: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  Low: "border-slate-700 bg-white/5 text-slate-400",
};

function StatusIcon({ status }: { status: JobStatus }) {
  const cls = `h-3.5 w-3.5 ${statusVariant[status].icon}`;
  switch (status) {
    case "Scheduled":
      return <CalendarDays className={cls} />;
    case "In Progress":
      return <Clock className={cls} />;
    case "On Hold":
      return <AlertTriangle className={cls} />;
    case "Completed":
      return <CheckCircle2 className={cls} />;
    default:
      return <Briefcase className={cls} />;
  }
}

function formatScheduledDate(iso: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function DispatchJobCard({
  job,
  onStatusChange,
  isUpdating = false,
}: DispatchJobCardProps) {
  const badgeStyles = statusVariant[job.status];

  return (
    <SurfaceCard className="group transition-all duration-200 hover:border-white/20">
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-slate-500">{job.jobNumber}</span>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${badgeStyles.badge}`}
              >
                <StatusIcon status={job.status} />
                {job.status}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-slate-500">
                {job.type}
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 text-xs font-medium ${priorityVariant[job.priority]}`}
              >
                {job.priority}
              </span>
            </div>

            <Link
              href={`/jobs/${job.id}`}
              className="mt-2 block text-sm font-semibold text-white hover:text-blue-300 transition-colors"
            >
              {job.title}
            </Link>
            <p className="mt-0.5 text-xs text-slate-400">{job.customerName}</p>
          </div>

          <div className="flex-shrink-0 text-right">
            <p className="text-xs font-medium text-slate-300">
              {formatScheduledDate(job.scheduledFor)}
            </p>
          </div>
        </div>

        {/* Location */}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {job.propertyName}
          </span>
          {job.assignedTo && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {job.assignedTo}
            </span>
          )}
        </div>

        {/* Quick Actions */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/5 pt-4">
          {job.status === "Scheduled" && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 border-violet-500/30 bg-violet-500/10 px-2.5 text-xs text-violet-300 hover:border-violet-500/50 hover:bg-violet-500/20"
              onClick={() => onStatusChange(job.id, "In Progress")}
              disabled={isUpdating}
            >
              <Play className="h-3 w-3" />
              Start Work
            </Button>
          )}

          {job.status === "In Progress" && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1 border-emerald-500/30 bg-emerald-500/10 px-2.5 text-xs text-emerald-300 hover:border-emerald-500/50 hover:bg-emerald-500/20"
                onClick={() => onStatusChange(job.id, "Completed")}
                disabled={isUpdating}
              >
                <CheckCircle2 className="h-3 w-3" />
                Complete
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1 border-amber-500/30 bg-amber-500/10 px-2.5 text-xs text-amber-300 hover:border-amber-500/50 hover:bg-amber-500/20"
                onClick={() => onStatusChange(job.id, "On Hold")}
                disabled={isUpdating}
              >
                <PauseCircle className="h-3 w-3" />
                Put on Hold
              </Button>
            </>
          )}

          {job.status === "On Hold" && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 border-blue-500/30 bg-blue-500/10 px-2.5 text-xs text-blue-300 hover:border-blue-500/50 hover:bg-blue-500/20"
              onClick={() => onStatusChange(job.id, "Scheduled")}
              disabled={isUpdating}
            >
              <CalendarDays className="h-3 w-3" />
              Resume
            </Button>
          )}

          <Link
            href={`/jobs/${job.id}`}
            className="ml-auto text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            View details →
          </Link>
        </div>
      </div>
    </SurfaceCard>
  );
}
