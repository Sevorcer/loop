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
  const [noSystemOverride, setNoSystemOverride] = useState<boolean | null>(null);
  const [recordedActivity, setRecordedActivity] = useState<JobActivity[]>([]);
  const [pendingNotes, setPendingNotes] = useState<JobNote[]>([]);
  const [noteOverrides, setNoteOverrides] = useState<Record<string, JobNote>>({});
  const [deleteRestorePending, setDeleteRestorePending] = useState(false);
  const activityItems = mergeRecordedActivity(recordedActivity, activity, job.id);
  const notesWithOverrides = notes.map((note) => noteOverrides[note.id] ?? note);
  const visibleNotes = mergePendingJobNotes(notesWithOverrides, pendingNotes);
  const liveJob: Job = {
    ...job,
    status: confirmedStatus && confirmedStatus !== job.status ? confirmedStatus : job.status,
    noSystemInstalled: noSystemOverride ?? job.noSystemInstalled,
    noSystemInstalledAt:
      noSystemOverride === true && !job.noSystemInstalled
        ? new Date().toISOString()
        : noSystemOverride === false
          ? null
          : job.noSystemInstalledAt,
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
      // Rethrow so every caller (Quick Actions, closeout panel, mobile action
      // bar) shows its own refusal and never reports a rejected change as done.
      throw err;
    }
  }

  function handlePriceRecorded(entry: JobActivity) {
    setRecordedActivity((current) =>
      current.some((item) => item.id === entry.id) ? current : [entry, ...current],
    );
  }

  function handleNoteUpdated(note: JobNote) {
    setNoteOverrides((current) => ({ ...current, [note.id]: note }));
    setPendingNotes((current) =>
      current.map((pending) => (pending.id === note.id ? note : pending)),
    );
    router.refresh();
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

  async function handleToggleNoSystemInstalled(value: boolean) {
    try {
      await requestJson(`/api/jobs/${job.id}`, {
        method: "PATCH",
        role,
        body: { action: "systems_attestation", noneInstalled: value },
      });
      setNoSystemOverride(value);
      pushToast(
        value ? "Marked as no system installed." : "Attestation removed.",
        "success",
      );
      router.refresh();
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Couldn't save the attestation.", "error");
      throw error;
    }
  }

  async function handleSoftDelete() {
        // Re-entry guard: a double-tap must not fire the action twice
        // (the duplicate restore used to surface a bogus "job not found").
        if (deleteRestorePending) return;
        setDeleteRestorePending(true);
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
    } finally {
            setDeleteRestorePending(false);
    }
    }
    
  async function handleRestore() {
    if (deleteRestorePending) return;
        setDeleteRestorePending(true);
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
    } finally {
      setDeleteRestorePending(false);
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
      onNoteUpdated={handleNoteUpdated}
      onUpdateQaChecklist={handleUpdateQaChecklist}
      onToggleNoSystemInstalled={handleToggleNoSystemInstalled}
      onSoftDelete={handleSoftDelete}
      onRestore={handleRestore}
            deleteRestorePending={deleteRestorePending}
      priceVisible={priceVisible}
      priceCents={priceCents}
    />
  );
}
