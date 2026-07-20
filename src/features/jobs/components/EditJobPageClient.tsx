"use client";

import { useMemo } from "react";
import { notFound, useRouter } from "next/navigation";

import { AccessDenied } from "@/components/atlas";
import { useSession } from "@/features/auth";
import { hasPermission } from "@/services/authorization";

import { JobForm } from "./JobForm";
import { useJobs } from "../state/JobsProvider";

export function EditJobPageClient({ id }: { id: string }) {
  const router = useRouter();
  const { hydrated, getJobById, updateJob } = useJobs();
  const { role, loading } = useSession();

  const job = useMemo(() => getJobById(id), [getJobById, id]);

  if (loading) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-sm text-slate-400">
        Loading job details...
      </div>
    );
  }

  if (!role || !hasPermission(role, "jobs", "update")) {
    return <AccessDenied description="You don't have permission to edit jobs." />;
  }

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
      onSubmit={(values) => {
        const updatedJob = updateJob(job.id, values);

        if (!updatedJob) {
          notFound();
        }

        router.push(`/jobs/${job.id}`);
      }}
    />
  );
}
