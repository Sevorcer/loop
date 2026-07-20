"use client";

import { useEffect, useMemo } from "react";
import { notFound, useRouter } from "next/navigation";

import { RoutePermissionGuard } from "@/components/atlas";

import { JobForm } from "./JobForm";
import { useJobs } from "../state/JobsProvider";

function EditJobFormContent({ id }: { id: string }) {
  const router = useRouter();
  const { hydrated, loading, error, getJobById, updateJob, loadJobDetails } = useJobs();

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

  return (
    <JobForm
      mode="edit"
      cancelHref={`/jobs/${job.id}`}
      initialValues={{
        estimateId: job.estimateId,
        equipmentBundleId: job.equipmentBundleId,
        title: job.title,
        customerName: job.customerName,
        propertyName: job.propertyName,
        assignedTo: job.assignedTo,
        scheduledFor: job.scheduledFor,
        type: job.type,
        priority: job.priority,
        location: job.location,
        summary: job.summary,
        notes: job.notes,
      }}
      onSubmit={async (values) => {
        const updatedJob = await updateJob(job.id, values);

        if (!updatedJob) {
          notFound();
        }

        router.push(`/jobs/${job.id}`);
      }}
    />
  );
}

export function EditJobPageClient({ id }: { id: string }) {
  return (
    <RoutePermissionGuard
      table="jobs"
      action="update"
      deniedDescription="You don't have permission to edit jobs."
    >
      <EditJobFormContent id={id} />
    </RoutePermissionGuard>
  );
}
