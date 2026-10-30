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
  const activityItems = mergeRecordedActivity(recordedActivity, activity, job.id);
  const liveJob: Job = {
    ...job,
    status: confirmedStatus && confirmedStatus !== job.status ? confirmedStatus : job.status,
  };

  async function handleUpdateStatus(status: JobStatus) {
    await requestJson(`/api/jobs/${job.id}`, {
      method: "PATCH",
      role,
      body: { action: "status", status },
    });
    setConfirmedStatus(status);
    pushToast(`Job moved to ${status}.`, "success");
    router.refresh();
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
      activity={activityItems}
      notes={notes}
      callbackContext={callbackContext}
      onUpdateStatus={handleUpdateStatus}
      onPriceRecorded={handlePriceRecorded}
      onAddNote={handleAddNote}
      onUpdateQaChecklist={handleUpdateQaChecklist}
      priceVisible={priceVisible}
      priceCents={priceCents}
    />
  );
}
