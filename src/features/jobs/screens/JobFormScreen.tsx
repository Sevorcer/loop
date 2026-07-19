"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { EmptyState } from "@/components/atlas";
import { Button } from "@/components/ui/button";

import { JobForm } from "../components/JobForm";
import { useJobs } from "../context/JobsContext";
import type { JobInput } from "../types";

type JobFormScreenProps = {
  mode: "create" | "edit";
};

export function JobFormScreen({ mode }: JobFormScreenProps) {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { createJob, getJobById, isHydrated, updateJob } = useJobs();

  const job = useMemo(
    () => (mode === "edit" ? getJobById(params.id) : undefined),
    [getJobById, mode, params.id]
  );

  if (!isHydrated) {
    return <div className="h-64 animate-pulse rounded-2xl bg-white" />;
  }

  if (mode === "edit" && !job) {
    return (
      <EmptyState
        title="Job not found"
        description="This job could not be loaded for editing. Return to the board and reopen it from the live list."
        action={
          <Link href="/jobs">
            <Button>Back to jobs</Button>
          </Link>
        }
      />
    );
  }

  function handleSubmit(input: JobInput) {
    if (mode === "create") {
      const id = createJob(input);
      router.push(`/jobs/${id}`);
      return;
    }

    updateJob(params.id, input);
    router.push(`/jobs/${params.id}`);
  }

  return (
    <JobForm
      mode={mode}
      job={job}
      onSubmit={handleSubmit}
      onCancelHref={mode === "create" ? "/jobs" : `/jobs/${params.id}`}
      submitLabel={mode === "create" ? "Create job" : "Save changes"}
    />
  );
}
