"use client";

import { useState } from "react";
import {
  Ban,
  CalendarClock,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  type LucideIcon,
} from "lucide-react";

import { StatusBadge } from "@/components/atlas";
import { useCurrentRole } from "@/features/auth";
import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";

import type { JobStatus } from "../types/job";
import { completionBlockers } from "../utils/jobCompletionChecklist";
import { getJobStatusIntent, getValidNextStatuses } from "../utils/jobWorkspace";

export function JobStatusFailure({ message }: { message: string }) {
  const missing = completionBlockers(message);
  const blocked = missing.length > 0 || message.toLowerCase().includes("cannot complete");
  return (
    <div
      role="alert"
      className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-3 text-sm text-red-200"
    >
      {blocked ? (
        <>
          <p className="font-medium text-red-100">This job was not marked complete. The status did not change.</p>
          {missing.length > 0 ? (
            <>
              <p className="mt-2">Still needed:</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {missing.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-2">{message}</p>
          )}
        </>
      ) : (
        <p>{message}</p>
      )}
    </div>
  );
}

function getStatusVariant(status: JobStatus) {
  if (status === "Completed") return "success" as const;
  if (status === "Scheduled") return "info" as const;
  if (status === "In Progress") return "warning" as const;
  if (status === "On Hold") return "neutral" as const;
  return "danger" as const;
}

interface StatusButtonConfig {
  status: JobStatus;
  icon: LucideIcon;
  label: string;
}

const STATUS_BUTTON_CONFIG: StatusButtonConfig[] = [
  { status: "In Progress", icon: PlayCircle, label: "Start Job" },
  { status: "Scheduled", icon: CalendarClock, label: "Return to Queue" },
  { status: "On Hold", icon: PauseCircle, label: "Put On Hold" },
  { status: "Completed", icon: CheckCircle2, label: "Mark Complete" },
  { status: "Cancelled", icon: Ban, label: "Cancel Job" },
];

export function JobStatusActions({
  status,
  onChangeStatus,
}: {
  status: JobStatus;
  onChangeStatus: (status: JobStatus) => Promise<void> | void;
}) {
  const [pendingStatus, setPendingStatus] = useState<JobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null); const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const helperText = getJobStatusIntent(status);

  const { role } = useCurrentRole();
  const validNextStatuses = getValidNextStatuses(status);
  const availableActions = STATUS_BUTTON_CONFIG.filter(({ status: next }) => {
    if (!validNextStatuses.includes(next)) return false;
    if (role === "tech" && next === "Cancelled") return false;
    return true;
  });

  function requestChange(nextStatus: JobStatus) { if (nextStatus === "Cancelled") { setCancelConfirmOpen(true); return; } void handleChange(nextStatus); } async function confirmCancel() { setCancelConfirmOpen(false); await handleChange("Cancelled"); }   async function handleChange(nextStatus: JobStatus) {
    try {
      setError(null);
      setSuccess(null);
      setPendingStatus(nextStatus);
      await onChangeStatus(nextStatus);
      setSuccess(`Job moved to ${nextStatus}.`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update job status. Please try again.",
      );
    } finally {
      setPendingStatus(null);
    }
  }

  return (
    <SurfaceCard>
      <div className="p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Quick Actions</h2>
            <p className="mt-1 text-sm text-slate-400">
              Update job execution status directly from the detail view.
            </p>
          </div>

          <StatusBadge variant={getStatusVariant(status)}>{status}</StatusBadge>
        </div>

        <p className="mt-4 text-sm leading-6 text-slate-400">{helperText}</p>

        {error ? <JobStatusFailure message={error} /> : null}
        {success && !error ? (
          <p className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            {success}
          </p>
        ) : null}

        {availableActions.length === 0 ? (
          <p className="mt-6 text-sm text-slate-500">No further actions available for this job.</p>
        ) : (
          // F14: glove-friendly targets on phones — full-width, 48px tall,
          // larger type. Desktop keeps the compact two-column grid.
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {availableActions.map(({ status: nextStatus, icon: Icon, label }) => (
              <Button
                key={nextStatus}
                onClick={() => requestChange(nextStatus)}
                className="min-h-[48px] justify-start gap-2 text-base md:min-h-0 md:text-sm"
                variant="secondary"
                disabled={pendingStatus !== null}
              >
                <Icon className="h-4 w-4" />
                {pendingStatus === nextStatus ? "Updating..." : label}
              </Button>
            ))}
          </div>
        )}
      </div>
          {cancelConfirmOpen ? (<div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-labelledby="cancel-job-title" aria-describedby="cancel-job-description"><div className="absolute inset-0 bg-black/60" onClick={() => setCancelConfirmOpen(false)} /><div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-xl"><h3 id="cancel-job-title" className="text-lg font-semibold text-white">Cancel this job?</h3><p id="cancel-job-description" className="mt-2 text-sm text-slate-400">This will remove the job from the active queue. You can reopen it later from the job detail page.</p><div className="mt-6 flex justify-end gap-2"><Button variant="outline" onClick={() => setCancelConfirmOpen(false)}>Keep Job</Button><Button variant="destructive" onClick={() => void confirmCancel()}>Cancel Job</Button></div></div></div>) : null}    </SurfaceCard>
  );
}
