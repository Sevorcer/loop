"use client";

import { useState } from "react";
import { ArrowRight, CalendarCheck, MapPin, UserCircle2, Wrench, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { StatusBadge } from "@/components/atlas";
import { Button } from "@/components/ui/button";

import type { CrewProfile } from "../types/dailyPlan";
import type { Job } from "@/features/jobs/types/job";
import {
  formatDateShort,
  getDayLabel,
  getTodayDate,
} from "../utils/planUtils";

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
  return <ShieldCheck className="h-3.5 w-3.5 text-violet-300" />;
}

function DateChip({ scheduledFor }: { scheduledFor: string | null }) {
  if (scheduledFor == null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-400">
        Unscheduled
      </span>
    );
  }

  const label = getDayLabel(scheduledFor);
  const isToday = scheduledFor === getTodayDate();

  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        isToday
          ? "border-blue-500/30 bg-blue-500/10 text-blue-300"
          : "border-white/10 bg-white/[0.05] text-slate-300",
      ].join(" ")}
    >
      <CalendarCheck className="h-3 w-3 shrink-0" />
      {isToday ? "Today" : label}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface JobScheduleCardProps {
  job: Job;
  crewOptions: CrewProfile[];
  onReschedule: (jobId: string, date: string) => void;
  onAssign: (jobId: string, technician: string) => void;
  /** When true, show "Schedule" instead of "Reschedule" */
  isUnscheduled?: boolean;
}

export function JobScheduleCard({
  job,
  crewOptions,
  onReschedule,
  onAssign,
  isUnscheduled = false,
}: JobScheduleCardProps) {
  const [picking, setPicking] = useState(false);
  const [dateValue, setDateValue] = useState(
    job.scheduledFor ?? getTodayDate()
  );

  const assignSelectId = `assign-${job.id}`;

  function handleConfirmDate() {
    if (dateValue) {
      onReschedule(job.id, dateValue);
    }
    setPicking(false);
  }

  function handleCancelDate() {
    setDateValue(job.scheduledFor ?? getTodayDate());
    setPicking(false);
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:bg-white/[0.05]">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {/* Type icon */}
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] ring-1 ring-white/10">
            {getTypeIcon(job.type)}
          </div>

          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500">{job.jobNumber}</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-white">
              {job.title}
            </p>
            <p className="mt-0.5 truncate text-xs text-slate-400">
              {job.customerName} · {job.propertyName}
            </p>
          </div>
        </div>

        <Link
          href={`/jobs/${job.id}`}
          aria-label={`Open ${job.jobNumber}: ${job.title}`}
          className="mt-1 inline-flex shrink-0 items-center gap-1 rounded-md text-xs text-slate-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70"
        >
          Open
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Location + crew — shown first for fast scanning */}
      <div className="mt-3 space-y-1.5">
        {job.location ? (
          <p className="flex items-center gap-1.5 text-xs text-slate-400">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            <span className="truncate">{job.location}</span>
          </p>
        ) : null}
        {job.assignedTo.trim() ? (
          <p className="flex items-center gap-1.5 text-xs text-slate-300">
            <UserCircle2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="truncate">{job.assignedTo}</span>
          </p>
        ) : (
          <p className="flex items-center gap-1.5 text-xs text-yellow-300">
            <UserCircle2 className="h-3.5 w-3.5 shrink-0" />
            Unassigned
          </p>
        )}
      </div>

      {/* Status chips */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <DateChip scheduledFor={job.scheduledFor} />
        <StatusBadge variant={getStatusVariant(job.status)}>{job.status}</StatusBadge>
        <StatusBadge variant={getPriorityVariant(job.priority)}>{job.priority}</StatusBadge>
        <StatusBadge variant="neutral">{job.type}</StatusBadge>
      </div>

      {/* Quick actions */}
      <div className="mt-3 flex flex-wrap items-end gap-3">
        {/* Reschedule / Schedule */}
        {picking ? (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateValue}
              min={getTodayDate()}
              onChange={(e) => setDateValue(e.target.value)}
              className="h-8 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-xs text-white outline-none focus:border-blue-500/40"
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={handleConfirmDate}
              className="h-8 rounded-xl border border-blue-500/20 bg-blue-500/[0.08] px-3 text-xs text-blue-200 hover:bg-blue-500/15"
            >
              {isUnscheduled ? "Schedule" : "Confirm"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCancelDate}
              className="h-8 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs text-slate-400 hover:bg-white/10"
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setPicking(true)}
            className="h-8 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs text-slate-300 hover:bg-white/10 hover:text-white"
          >
            {isUnscheduled ? "Schedule" : "Reschedule"}
          </Button>
        )}

        {/* Assign crew */}
        {!picking && (
          <div className="flex flex-col gap-1">
            <label
              htmlFor={assignSelectId}
              className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500"
            >
              Crew
            </label>
            <select
              id={assignSelectId}
              value={job.assignedTo}
              onChange={(e) => onAssign(job.id, e.target.value)}
              className="h-8 rounded-xl border border-white/10 bg-white/[0.05] px-2 text-xs text-white outline-none transition focus:border-blue-500/30"
            >
              <option value="">Unassigned</option>
              {crewOptions.map((crew) => (
                <option key={crew.id} value={crew.technician}>
                  {crew.leadInstaller}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
