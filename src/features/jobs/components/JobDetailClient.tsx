"use client";

import { useRouter } from "next/navigation";

import { useCurrentRole } from "@/features/auth";
import { requestJson } from "@/lib/api/client";

import type { Job, JobStatus } from "../types/job";
import type { JobActivity } from "../types/jobActivity";
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

  async function handleAddNote(note: string) {
    await requestJson(`/api/jobs/${job.id}`, {
      method: "PATCH",
      role,
      body: { action: "note", note },
    });
    router.refresh();
  }

  return (
    <JobDetailScreen
      job={job}
      activity={activity}
      onUpdateStatus={handleUpdateStatus}
      onAddNote={handleAddNote}
    />
  );
}
