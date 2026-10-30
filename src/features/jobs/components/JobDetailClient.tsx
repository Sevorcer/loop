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
import { JOB_NOTE_SAVED_TOAST } from "../utils/jobNotes";
import { JobDetailScreen } from "./JobDetailScreen";

interface JobDetailClientProps {
  job: Job;
  activity: JobActivity[];
  notes: JobNote[];
  callbackContext: JobCallbackContext;
}

export function JobDetailClient({ job, activity, notes, callbackContext }: JobDetailClientProps) {
  const router = useRouter();
  const { role } = useCurrentRole();
  const [optimisticStatus, setOptimisticStatus] = useState<JobStatus | null>(null);
  const liveJob: Job = {
    ...job,
    status: optimisticStatus && optimisticStatus !== job.status ? optimisticStatus : job.status,
  };

  async function handleUpdateStatus(status: JobStatus) {
    setOptimisticStatus(status);
    try {
      await requestJson(`/api/jobs/${job.id}`, {
        method: "PATCH",
        role,
        body: { action: "status", status },
      });
      pushToast(`Job moved to ${status}.`, "success");
      router.refresh();
    } catch (error) {
      setOptimisticStatus(null);
      pushToast(
        error instanceof Error ? error.message : "Couldn't update the job status.",
        "error",
      );
      throw error;
    }
  }

  async function handleAddNote(note: string) {
    try {
      await requestJson(`/api/jobs/${job.id}`, {
        method: "PATCH",
        role,
        body: { action: "notes", notes: note },
      });
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

  return (
    <JobDetailScreen
      job={liveJob}
      activity={activity}
      notes={notes}
      callbackContext={callbackContext}
      onUpdateStatus={handleUpdateStatus}
      onAddNote={handleAddNote}
      onUpdateQaChecklist={handleUpdateQaChecklist}
    />
  );
}
