"use client";

import { useEffect, useMemo } from "react";
import { notFound } from "next/navigation";

import { useJobs } from "../state/JobsProvider";
import { JobDetailScreen } from "./JobDetailScreen";

export function JobDetailPageClient({ id }: { id: string }) {
  const { hydrated, loading, error, getJobById, loadJobDetails } = useJobs();

  const job = useMemo(() => getJobById(id), [getJobById, id]);

  useEffect(() => {
    if (!job) {
      void loadJobDetails(id);
    }
  }, [id, job, loadJobDetails]);

  if (!hydrated || loading) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-sm text-slate-400">
        Loading job details...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-200">
        {error}
      </div>
    );
  }

  if (!job) {
    notFound();
  }

  return <JobDetailScreen job={job} />;
}