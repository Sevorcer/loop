"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";

import { JobForm, type JobFormValues } from "./JobForm";
import { useJobs } from "../state/JobsProvider";

export function NewJobForm() {
  const router = useRouter();
  const { createJob } = useJobs();

  const [submittedJobId, setSubmittedJobId] = useState<string | null>(null);

  function handleSubmit(values: JobFormValues) {
    const job = createJob(values);
    setSubmittedJobId(job.id);
  }

  if (submittedJobId) {
    return (
      <SurfaceCard className="mx-auto max-w-3xl">
        <div className="space-y-4 p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-500/15 to-blue-500/10 ring-1 ring-white/10">
            <CheckCircle2 className="h-7 w-7 text-emerald-300" />
          </div>

          <div>
            <h1 className="text-2xl font-semibold text-white">Job created</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Your new job has been added to the Jobs board and is ready for
              execution tracking.
            </p>
          </div>

          <div className="flex justify-center gap-3">
            <Link href="/jobs">
              <Button variant="secondary">Back to Jobs</Button>
            </Link>

            <Button onClick={() => router.push(`/jobs/${submittedJobId}`)}>
              Open Job
            </Button>
          </div>
        </div>
      </SurfaceCard>
    );
  }

  return (
    <JobForm mode="create" cancelHref="/jobs" onSubmit={handleSubmit} />
  );
}