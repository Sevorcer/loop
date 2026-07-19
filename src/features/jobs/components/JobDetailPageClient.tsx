"use client";

import { useMemo } from "react";
import { notFound } from "next/navigation";

import { useJobs } from "../state/JobsProvider";
import { JobDetailScreen } from "./JobDetailScreen";

export function JobDetailPageClient({ id }: { id: string }) {
  const { hydrated, getJobById } = useJobs();

  const job = useMemo(() => getJobById(id), [getJobById, id]);

  if (!hydrated) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-sm text-slate-400">
        Loading job details...
      </div>
    );
  }

  if (!job) {
    notFound();
  }

  return <JobDetailScreen job={job} />;
}