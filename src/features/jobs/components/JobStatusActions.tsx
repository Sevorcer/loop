"use client";

import { useState } from "react";
import { Ban, CheckCircle2, PauseCircle, PlayCircle } from "lucide-react";

import { StatusBadge } from "@/components/atlas";
import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";

import type { JobStatus } from "../types/job";
import { getJobStatusIntent } from "../utils/jobWorkspace";

function getStatusVariant(status: JobStatus) {
  if (status === "Completed") return "success" as const;
  if (status === "Scheduled") return "info" as const;
  if (status === "In Progress") return "warning" as const;
  if (status === "On Hold") return "neutral" as const;
  return "danger" as const;
}

export function JobStatusActions({
  status,
  onChangeStatus,
}: {
  status: JobStatus;
  onChangeStatus: (status: JobStatus) => Promise<void> | void;
}) {
  const [pendingStatus, setPendingStatus] = useState<JobStatus | null>(null);
  const helperText = getJobStatusIntent(status);

  async function handleChange(nextStatus: JobStatus) {
    try {
      setPendingStatus(nextStatus);
      await onChangeStatus(nextStatus);
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

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Button
            onClick={() => void handleChange("In Progress")}
            className="justify-start gap-2"
            variant="secondary"
            disabled={pendingStatus !== null}
          >
            <PlayCircle className="h-4 w-4" />
            {pendingStatus === "In Progress" ? "Updating..." : "Start Job"}
          </Button>

          <Button
            onClick={() => void handleChange("On Hold")}
            className="justify-start gap-2"
            variant="secondary"
            disabled={pendingStatus !== null}
          >
            <PauseCircle className="h-4 w-4" />
            {pendingStatus === "On Hold" ? "Updating..." : "Put On Hold"}
          </Button>

          <Button
            onClick={() => void handleChange("Completed")}
            className="justify-start gap-2"
            variant="secondary"
            disabled={pendingStatus !== null}
          >
            <CheckCircle2 className="h-4 w-4" />
            {pendingStatus === "Completed" ? "Updating..." : "Mark Complete"}
          </Button>

          <Button
            onClick={() => void handleChange("Cancelled")}
            className="justify-start gap-2"
            variant="secondary"
            disabled={pendingStatus !== null}
          >
            <Ban className="h-4 w-4" />
            {pendingStatus === "Cancelled" ? "Updating..." : "Cancel Job"}
          </Button>
        </div>
      </div>
    </SurfaceCard>
  );
}
