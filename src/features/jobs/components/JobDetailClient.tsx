"use client";

import { useRouter } from "next/navigation";

import { useCurrentRole } from "@/features/auth";
import { requestJson } from "@/lib/api/client";

import type { Job, JobStatus } from "../types/job";
import type { JobActivity } from "../types/jobActivity";
import type { RequiredQaChecklist } from "../utils/jobCompletionChecklist";
import { JobDetailScreen } from "./JobDetailScreen";

interface JobDetailClientProps {
  job: Job;
  activity: JobActivity[];
}

export function JobDetailClient({ job, activity }: JobDetailClientProps) {
  const router = useRouter();
  const { role } = useCurrentRole();

  async function handleUpdateStatus(status: JobStatus) {
    await requestJson(`/api/jobs/${job.id}`, {
      method: "PATCH",
      role,
      body: { action: "status", status },
    });
    router.refresh();
  }

  async function handleSaveNotes(notes: string) {
    await requestJson(`/api/jobs/${job.id}`, {
      method: "PATCH",
      role,
      body: { action: "notes", notes },
    });
    router.refresh();
  }

  async function handleUpdateQaChecklist(checklist: RequiredQaChecklist) {
    await requestJson(`/api/jobs/${job.id}`, {
      method: "PATCH",
      role,
      body: { action: "qa", checklist },
    });
    router.refresh();
  }

  return (
    <JobDetailScreen
      job={job}
      activity={activity}
      onUpdateStatus={handleUpdateStatus}
      onSaveNotes={handleSaveNotes}
      onUpdateQaChecklist={handleUpdateQaChecklist}
    />
  );
}
