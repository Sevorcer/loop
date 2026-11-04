"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { pushToast } from "@/components/ui/toast";
import { useCurrentRole } from "@/features/auth";
import { requestJson } from "@/lib/api/client";

import type { Job, JobStatus } from "../types/job";
import type { JobActivity } from "../types/jobActivity";
import type { JobCallbackContext } from "../types/jobCallback";
import type { JobNote } from "../types/jobNote";
import type { RequiredQaChecklist } from "../utils/jobCompletionChecklist";
import { JOB_NOTE_SAVED_TOAST, mergePendingJobNotes } from "../utils/jobNotes";
import { mergeRecordedActivity } from "../utils/jobWorkspace";
import { JobDetailScreen } from "./JobDetailScreen";

interface JobDetailClientProps {
  job: Job;
  activity: JobActivity[];
  notes: JobNote[];
  callbackContext: JobCallbackContext;
  priceVisible?: boolean;
  priceCents?: number | null;
}

export function JobDetailClient({
  job,
  activity,
  notes,
  callbackContext,
  priceVisible = false,
  priceCents = null,
}: JobDetailClientProps) {
  const router = useRouter();
  const { role } = useCurrentRole();
  const [confirmedStatus, setConfirmedStatus] = useState<JobStatus | null>(null);
  const [recordedActivity, setRecordedActivity] = useState<JobActivity[]>([]);
  const [pendingNotes, setPendingNotes] = useState<JobNote[]>([]);
  const activityItems = mergeRecordedActivity(recordedActivity, activity, job.id);
  const visibleNotes = mergePendingJobNotes(notes, pendingNotes);
  const liveJob: Job = {
    ...job,
    status: confirmedStatus && confirmedStatus !== job.status ? confirmedStatus : job.status,
  };

  async function handleUpdateStatus(status: JobStatus) {
    try {
      await requestJson(`/api/jobs/${job.id}`, {
        method: "PATCH",
        role,
        body: { action: "status", status },
      });
      setConfirmedStatus(status);
      pushToast(`Job moved to ${status}.`, "success");
      router.refresh();
    } catch (err) {
      console.error("[JobDetailClient] status update failed", err);
      pushToast(
        err instanceof Error ? err.message : "Failed to update job status.",
        "error",
      );
    }
  }

  function handlePriceRecorded(entry: JobActivity) {
    setRecordedActivity((current) =>
      current.some((item) => item.id === entry.id) ? current : [entry, ...current],
    );
  }

  async function handleAddNote(note: string) {
    try {
      await requestJson(`/api/jobs/${job.id}`, {
        method: "PATCH",
        role,
        body: { action: "notes", notes: note },
      });
      // Optimistically show the note now. router.refresh() often does not
      // deliver the new job_notes row before the viewer looks, which left the
      // Notes section reading "No notes…" until a full reload. mergePendingJobNotes
      // drops this copy once the refreshed server list carries the real row.
      const trimmed = note.trim();
      if (trimmed) {
        const optimisticId =
          typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? `optimistic-${crypto.randomUUID()}`
            : `optimistic-${Date.now()}`;
        setPendingNotes((current) => [
          ...current,
          {
            id: optimisticId,
            jobId: job.id,
            body: trimmed,
            authorId: null,
            authorName: "You",
            authorRole: role ?? "",
            createdAt: new Date().toISOString(),
          },
        ]);
      }
      pushToast(JOB_NOTE_SAVED_TOAST, "success");
      router.refresh();
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Couldn't save the note.", "error");
      throw error;
    }
  }

  async function handleUpdateQaChecklist(checklist: RequiredQaChecklist) {
    try {
      await requestJson(`/api/jobs/${job.id}`, {
        method: "PATCH",
        role,
        body: { action: "qa", checklist },
      });
      pushToast("Checklist saved.", "success");
      router.refresh();
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Couldn't save the checklist.", "error");
      throw error;
    }
  }

  async function handleSoftDelete() {
    try {
      await requestJson(`/api/jobs/${job.id}`, {
        method: "PATCH",
        role,
        body: { action: "soft-delete" },
      });
      pushToast("Job deleted.", "success");
      router.push("/jobs");
      router.refresh();
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Couldn't delete the job.", "error");
    }
  }

  async function handleRestore() {
    try {
      await requestJson(`/api/jobs/${job.id}`, {
        method: "PATCH",
        role,
        body: { action: "restore" },
      });
      pushToast("Job restored.", "success");
      router.refresh();
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Couldn't restore the job.", "error");
    }
  }

  return (
    <JobDetailScreen
      job={liveJob}
      activity={activityItems}
      notes={visibleNotes}
      callbackContext={callbackContext}
      onUpdateStatus={handleUpdateStatus}
      onPriceRecorded={handlePriceRecorded}
      onAddNote={handleAddNote}
      onUpdateQaChecklist={handleUpdateQaChecklist}
      onSoftDelete={handleSoftDelete}
      onRestore={handleRestore}
      priceVisible={priceVisible}
      priceCents={priceCents}
    />
  );
}
