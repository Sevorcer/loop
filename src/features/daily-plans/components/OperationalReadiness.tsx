import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Gauge,
  UserX,
  XCircle,
} from "lucide-react";

import type { Job } from "@/features/jobs/types/job";

import { computeReadiness, getReadinessStatus } from "../utils/planUtils";

interface ReadinessFlag {
  label: string;
  detail: string;
  status: "ok" | "warn" | "error";
  icon: React.ReactNode;
}

function buildFlags(jobs: Job[]): ReadinessFlag[] {
  const flags: ReadinessFlag[] = [];
  const unassigned = jobs.filter((j) => !j.assignedTo.trim());
  const onHold = jobs.filter((j) => j.status === "On Hold");
  const cancelled = jobs.filter((j) => j.status === "Cancelled");
  const highPriorityUnready = jobs.filter(
    (j) =>
      j.priority === "High" &&
      j.status !== "In Progress" &&
      j.status !== "Completed" &&
      j.status !== "Cancelled"
  );

  if (unassigned.length === 0) {
    flags.push({
      label: "All jobs assigned",
      detail: "No unassigned work remaining",
      status: "ok",
      icon: <CheckCircle2 className="h-4 w-4 text-green-400" />,
    });
  } else {
    flags.push({
      label: `${unassigned.length} unassigned ${unassigned.length === 1 ? "job" : "jobs"}`,
      detail: "Crew assignment required before execution",
      status: "error",
      icon: <UserX className="h-4 w-4 text-red-400" />,
    });
  }

  if (onHold.length === 0) {
    flags.push({
      label: "No jobs on hold",
      detail: "All active work is moving forward",
      status: "ok",
      icon: <CheckCircle2 className="h-4 w-4 text-green-400" />,
    });
  } else {
    flags.push({
      label: `${onHold.length} ${onHold.length === 1 ? "job" : "jobs"} on hold`,
      detail: "Blocked — waiting on resolution before proceeding",
      status: "warn",
      icon: <AlertTriangle className="h-4 w-4 text-yellow-400" />,
    });
  }

  if (highPriorityUnready.length > 0) {
    flags.push({
      label: `${highPriorityUnready.length} high-priority ${highPriorityUnready.length === 1 ? "job" : "jobs"} need action`,
      detail: "Confirm crew, access, and readiness before dispatch",
      status: "warn",
      icon: <AlertTriangle className="h-4 w-4 text-yellow-400" />,
    });
  }

  if (cancelled.length > 0) {
    flags.push({
      label: `${cancelled.length} ${cancelled.length === 1 ? "job" : "jobs"} cancelled`,
      detail: "Review and remove from active schedule if needed",
      status: "warn",
      icon: <XCircle className="h-4 w-4 text-slate-400" />,
    });
  }

  if (jobs.length === 0) {
    flags.push({
      label: "No jobs scheduled",
      detail: "The day is clear — no active work planned",
      status: "ok",
      icon: <Circle className="h-4 w-4 text-slate-400" />,
    });
  }

  return flags;
}

interface OperationalReadinessProps {
  jobs: Job[];
}

export function OperationalReadiness({ jobs }: OperationalReadinessProps) {
  const metrics = computeReadiness(jobs);
  const status = getReadinessStatus(metrics.readinessScore);

  const flags = buildFlags(jobs);

  const scoreBarColor =
    metrics.readinessScore >= 85
      ? "bg-green-500"
      : metrics.readinessScore >= 60
        ? "bg-yellow-500"
        : "bg-red-500";

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/15 to-slate-500/5 ring-1 ring-white/10">
          <Gauge className="h-4.5 w-4.5 text-blue-300" />
        </div>

        <div>
          <p className="text-sm font-semibold text-white">Operational Readiness</p>
          <p className="text-xs text-slate-400">Day execution status</p>
        </div>
      </div>

      <div className="mb-5">
        <div className="mb-2 flex items-end justify-between">
          <span className={["text-lg font-bold", status.color].join(" ")}>
            {status.label}
          </span>
          <span className="text-sm font-semibold text-white">
            {metrics.readinessScore}
            <span className="text-xs font-normal text-slate-400">/100</span>
          </span>
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className={["h-full rounded-full transition-all duration-500", scoreBarColor].join(" ")}
            style={{ width: `${metrics.readinessScore}%` }}
          />
        </div>
      </div>

      <div className="space-y-3">
        {flags.map((flag, index) => (
          <div
            key={index}
            className={[
              "flex items-start gap-3 rounded-xl p-3",
              flag.status === "error"
                ? "border border-red-500/15 bg-red-500/[0.06]"
                : flag.status === "warn"
                  ? "border border-yellow-500/15 bg-yellow-500/[0.04]"
                  : "border border-white/5 bg-white/[0.02]",
            ].join(" ")}
          >
            <div className="mt-0.5 shrink-0">{flag.icon}</div>

            <div>
              <p className="text-xs font-semibold text-slate-200">{flag.label}</p>
              <p className="mt-0.5 text-xs text-slate-500">{flag.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
