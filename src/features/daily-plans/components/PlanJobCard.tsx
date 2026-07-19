import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  MapPin,
  PauseCircle,
  Wrench,
} from "lucide-react";

import { StatusBadge } from "@/components/atlas";

import type { Job } from "@/features/jobs/types/job";

function getStatusVariant(status: Job["status"]) {
  if (status === "Completed") return "success" as const;
  if (status === "Scheduled") return "info" as const;
  if (status === "In Progress") return "warning" as const;
  if (status === "On Hold") return "neutral" as const;
  return "danger" as const;
}

function getPriorityVariant(priority: Job["priority"]) {
  if (priority === "High") return "danger" as const;
  if (priority === "Medium") return "warning" as const;
  return "neutral" as const;
}

function getTypeIcon(type: Job["type"]) {
  if (type === "Service" || type === "Maintenance") {
    return <Wrench className="h-3.5 w-3.5 text-blue-300" />;
  }
  return <Briefcase className="h-3.5 w-3.5 text-red-300" />;
}

function getRiskFlags(job: Job): string[] {
  const flags: string[] = [];
  if (job.status === "On Hold") flags.push("On Hold");
  if (!job.assignedTo.trim()) flags.push("Unassigned");
  if (job.priority === "High" && job.status !== "In Progress" && job.status !== "Completed") {
    flags.push("High Priority");
  }
  return flags;
}

interface PlanJobCardProps {
  job: Job;
}

export function PlanJobCard({ job }: PlanJobCardProps) {
  const riskFlags = getRiskFlags(job);
  const isAtRisk = riskFlags.length > 0;

  return (
    <Link
      href={`/jobs/${job.id}`}
      className={[
        "group block rounded-2xl border p-4 transition-all duration-200 hover:bg-white/[0.05]",
        isAtRisk
          ? "border-red-500/20 bg-red-500/[0.04]"
          : "border-white/10 bg-white/[0.03]",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] ring-1 ring-white/10">
            {getTypeIcon(job.type)}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-400">
                {job.jobNumber}
              </span>
              {isAtRisk && (
                <AlertTriangle className="h-3 w-3 shrink-0 text-red-400" />
              )}
            </div>

            <p className="mt-0.5 truncate text-sm font-medium text-white">
              {job.title}
            </p>

            <p className="mt-0.5 truncate text-xs text-slate-400">
              {job.customerName} · {job.propertyName}
            </p>
          </div>
        </div>

        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-600 transition-colors group-hover:text-slate-300" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusBadge variant={getStatusVariant(job.status)}>
          {job.status}
        </StatusBadge>

        <StatusBadge variant={getPriorityVariant(job.priority)}>
          {job.priority}
        </StatusBadge>

        <StatusBadge variant="neutral">{job.type}</StatusBadge>
      </div>

      {job.location ? (
        <div className="mt-3 flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-500" />
          <span className="truncate text-xs text-slate-400">{job.location}</span>
        </div>
      ) : null}

      {riskFlags.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {riskFlags.map((flag) => (
            <span
              key={flag}
              className="inline-flex items-center gap-1 rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-300"
            >
              {flag === "On Hold" && <PauseCircle className="h-3 w-3" />}
              {flag}
            </span>
          ))}
        </div>
      ) : null}
    </Link>
  );
}
