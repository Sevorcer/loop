import { User } from "lucide-react";

import type { Job } from "@/features/jobs/types/job";

import { PlanJobCard } from "./PlanJobCard";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getWorkloadLabel(count: number): string {
  if (count === 1) return "1 job";
  return `${count} jobs`;
}

function getWorkloadColor(jobs: Job[]): string {
  const hasOnHold = jobs.some((j) => j.status === "On Hold");
  const hasHigh = jobs.some((j) => j.priority === "High");
  const hasInProgress = jobs.some((j) => j.status === "In Progress");

  if (hasOnHold) return "border-yellow-500/30 bg-yellow-500/[0.06]";
  if (hasHigh && !hasInProgress) return "border-red-500/20 bg-red-500/[0.04]";
  return "border-white/10 bg-white/[0.03]";
}

interface CrewSectionProps {
  technician: string;
  jobs: Job[];
}

export function CrewSection({ technician, jobs }: CrewSectionProps) {
  const initials = getInitials(technician);
  const workloadColor = getWorkloadColor(jobs);
  const inProgress = jobs.filter((j) => j.status === "In Progress").length;
  const onHold = jobs.filter((j) => j.status === "On Hold").length;
  const highPriority = jobs.filter((j) => j.priority === "High").length;

  return (
    <div className={["rounded-3xl border p-5", workloadColor].join(" ")}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/20 to-slate-500/10 ring-1 ring-white/10">
            <span className="text-xs font-semibold text-slate-200">
              {initials}
            </span>
          </div>

          <div>
            <p className="text-sm font-semibold text-white">{technician}</p>
            <p className="text-xs text-slate-400">
              {getWorkloadLabel(jobs.length)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {inProgress > 0 && (
            <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 text-xs font-medium text-yellow-300">
              {inProgress} active
            </span>
          )}
          {onHold > 0 && (
            <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-xs font-medium text-orange-300">
              {onHold} on hold
            </span>
          )}
          {highPriority > 0 && (
            <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-300">
              {highPriority} high
            </span>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {jobs.map((job) => (
          <PlanJobCard key={job.id} job={job} />
        ))}
      </div>
    </div>
  );
}

export function UnassignedCrewSection({ jobs }: { jobs: Job[] }) {
  return (
    <div className="rounded-3xl border border-red-500/20 bg-red-500/[0.05] p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-red-500/15 ring-1 ring-red-500/20">
            <User className="h-5 w-5 text-red-300" />
          </div>

          <div>
            <p className="text-sm font-semibold text-red-200">Unassigned</p>
            <p className="text-xs text-slate-400">
              {getWorkloadLabel(jobs.length)} · needs crew assignment
            </p>
          </div>
        </div>

        <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-300">
          Action needed
        </span>
      </div>

      <div className="space-y-2">
        {jobs.map((job) => (
          <PlanJobCard key={job.id} job={job} />
        ))}
      </div>
    </div>
  );
}
