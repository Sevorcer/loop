import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Camera,
  MapPin,
  Phone,
  Printer,
  ShieldCheck,
  Timer,
  TriangleAlert,
  Wrench,
} from "lucide-react";

import { StatusBadge } from "@/components/atlas";
import { Button } from "@/components/ui/button";

import type { CrewProfile, PlanReadinessState, PlannedJob } from "../types/dailyPlan";
import { formatHours } from "../utils/planUtils";

function getStatusVariant(status: PlannedJob["status"]) {
  if (status === "Completed") return "success" as const;
  if (status === "Scheduled") return "info" as const;
  if (status === "In Progress") return "warning" as const;
  if (status === "On Hold") return "neutral" as const;
  return "danger" as const;
}

function getPriorityVariant(priority: PlannedJob["priority"]) {
  if (priority === "High") return "danger" as const;
  if (priority === "Medium") return "warning" as const;
  return "neutral" as const;
}

function getReadinessVariant(job: PlannedJob) {
  if (job.readiness.state === "ready") return "success" as const;
  if (job.readiness.state === "warning") return "warning" as const;
  return "danger" as const;
}

function getTypeIcon(type: PlannedJob["type"]) {
  if (type === "Service" || type === "Maintenance") {
    return <Wrench className="h-3.5 w-3.5 text-blue-300" />;
  }

  return <ShieldCheck className="h-3.5 w-3.5 text-red-300" />;
}

interface PlanJobCardProps {
  job: PlannedJob;
  crewOptions: CrewProfile[];
  onAssign: (jobId: string, technician: string) => void;
  onSetReadiness: (jobId: string, state: PlanReadinessState) => void;
  onDelay: (jobId: string) => void;
  onPlaceholderAction: (message: string) => void;
}

export function PlanJobCard({
  job,
  crewOptions,
  onAssign,
  onSetReadiness,
  onDelay,
  onPlaceholderAction,
}: PlanJobCardProps) {
  const readinessLabel =
    job.manualState === "ready"
      ? "Manager Ready"
      : job.manualState === "needs-attention"
        ? "Needs Attention"
        : job.readiness.state === "ready"
          ? "Ready"
          : job.readiness.state === "warning"
            ? "Watch"
            : "Blocked";
  const missingMaterials = job.readiness.missingMaterials.slice(0, 2);

  return (
    <div
      className={[
        "rounded-2xl border p-4",
        job.readiness.state === "blocked"
          ? "border-red-500/20 bg-red-500/[0.04]"
          : job.readiness.state === "warning"
            ? "border-yellow-500/20 bg-yellow-500/[0.04]"
            : "border-white/10 bg-white/[0.03]",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] ring-1 ring-white/10">
            {getTypeIcon(job.type)}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-400">{job.jobNumber}</span>
              {job.readiness.state !== "ready" ? (
                <AlertTriangle className="h-3 w-3 shrink-0 text-yellow-300" />
              ) : null}
            </div>

            <p className="mt-0.5 text-sm font-medium text-white">{job.title}</p>
            <p className="mt-0.5 text-xs text-slate-400">
              {job.customerName} · {job.propertyName}
            </p>
          </div>
        </div>

        <Link
          href={`/jobs/${job.id}`}
          className="mt-1 inline-flex shrink-0 items-center gap-1 text-xs text-slate-400 transition-colors hover:text-white"
        >
          Open
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusBadge variant={getStatusVariant(job.status)}>{job.status}</StatusBadge>
        <StatusBadge variant={getPriorityVariant(job.priority)}>{job.priority}</StatusBadge>
        <StatusBadge variant="neutral">{job.type}</StatusBadge>
        <StatusBadge variant={getReadinessVariant(job)}>{readinessLabel}</StatusBadge>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Planning</p>
          <div className="mt-3 space-y-2 text-sm text-slate-300">
            <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-3.5 w-3.5 text-slate-500" /><span>{job.location} · {job.planning.city}</span></p>
            <p className="flex items-start gap-2"><Timer className="mt-0.5 h-3.5 w-3.5 text-slate-500" /><span>{formatHours(job.planning.estimatedHours)} estimated</span></p>
            <p className="flex items-start gap-2"><CalendarClock className="mt-0.5 h-3.5 w-3.5 text-slate-500" /><span>{job.planning.arrivalWindow}</span></p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Scope</p>
          <div className="mt-3 space-y-2 text-sm text-slate-300">
            <p>{job.planning.equipment}</p>
            <p className="text-xs leading-5 text-slate-400">{job.summary}</p>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span
          className={[
            "rounded-full border px-2 py-1",
            job.planning.permitRequired
              ? job.readiness.blockers.includes("Permit approved")
                ? "border-red-500/20 bg-red-500/10 text-red-200"
                : "border-yellow-500/20 bg-yellow-500/10 text-yellow-200"
              : "border-white/10 bg-white/[0.04] text-slate-300",
          ].join(" ")}
        >
          {job.planning.permitRequired ? "Permit required" : "No permit"}
        </span>
        <span
          className={[
            "rounded-full border px-2 py-1",
            job.planning.photosRequired
              ? "border-blue-500/20 bg-blue-500/10 text-blue-200"
              : "border-white/10 bg-white/[0.04] text-slate-300",
          ].join(" ")}
        >
          <span className="inline-flex items-center gap-1">
            <Camera className="h-3 w-3" />
            {job.planning.photosRequired ? "Photos required" : "Photos optional"}
          </span>
        </span>
        <span
          className={[
            "rounded-full border px-2 py-1",
            job.planning.materialsReady
              ? "border-green-500/20 bg-green-500/10 text-green-200"
              : "border-red-500/20 bg-red-500/10 text-red-200",
          ].join(" ")}
        >
          {job.planning.materialsReady ? "Materials ready" : "Materials missing"}
        </span>
      </div>

      {(job.planning.specialNotes || job.notes) && (
        <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-5 text-slate-300">
          <p className="font-semibold uppercase tracking-[0.18em] text-slate-500">Morning notes</p>
          <p className="mt-2 text-slate-300">{job.planning.specialNotes ?? job.notes}</p>
        </div>
      )}

      {(job.readiness.blockers.length > 0 || job.readiness.warnings.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {job.readiness.blockers.slice(0, 3).map((flag) => (
            <span
              key={flag}
              className="inline-flex items-center gap-1 rounded-full border border-red-500/20 bg-red-500/10 px-2 py-1 text-xs font-medium text-red-200"
            >
              <TriangleAlert className="h-3 w-3" />
              {flag}
            </span>
          ))}
          {job.readiness.warnings.slice(0, 2).map((flag) => (
            <span
              key={flag}
              className="inline-flex items-center gap-1 rounded-full border border-yellow-500/20 bg-yellow-500/10 px-2 py-1 text-xs font-medium text-yellow-200"
            >
              <TriangleAlert className="h-3 w-3" />
              {flag}
            </span>
          ))}
        </div>
      )}

      {missingMaterials.length > 0 ? (
        <p className="mt-3 text-xs text-red-200">
          Missing material{missingMaterials.length === 1 ? "" : "s"}: {missingMaterials.join(", ")}
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Assign crew
          </span>
          <select
            value={job.assignedTo}
            onChange={(event) => onAssign(job.id, event.target.value)}
            className="h-9 w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 text-sm text-white outline-none transition focus:border-blue-500/30"
          >
            <option value="">Unassigned</option>
            {crewOptions.map((crew) => (
              <option key={crew.id} value={crew.technician}>
                {crew.leadInstaller} · {crew.availability}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-wrap items-end gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              onSetReadiness(
                job.id,
                job.manualState === "ready" ? "needs-attention" : "ready"
              )
            }
            className="h-9 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-xs text-slate-200 hover:bg-white/10"
          >
            {job.manualState === "ready" ? "Needs attention" : "Mark ready"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDelay(job.id)}
            className="h-9 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-xs text-slate-200 hover:bg-white/10"
          >
            Delay 1 day
          </Button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onPlaceholderAction(`Call prep opened for ${job.customerName}.`)}
          className="h-8 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs text-slate-300 hover:bg-white/10"
        >
          <Phone className="h-3.5 w-3.5" />
          Call customer
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onPlaceholderAction(`Packet queued for ${job.jobNumber}.`)}
          className="h-8 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs text-slate-300 hover:bg-white/10"
        >
          <Printer className="h-3.5 w-3.5" />
          Print packet
        </Button>
      </div>
    </div>
  );
}
