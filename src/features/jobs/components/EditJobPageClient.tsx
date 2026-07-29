"use client";

import { useRouter } from "next/navigation";

import { RoutePermissionGuard } from "@/components/atlas";
import { useCurrentRole } from "@/features/auth";
import { requestJson } from "@/lib/api/client";

import type { Job } from "../types/job";
import { JobForm } from "./JobForm";

interface EditJobPageClientProps {
  job: Job;
}

import { jobToFormScheduling } from "./JobForm";

function EditJobFormContent({ job }: EditJobPageClientProps) {
  const router = useRouter();
  const { role } = useCurrentRole();

  const schedulingValues = jobToFormScheduling(job);

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
        ...schedulingValues,
        type: job.type,
        priority: job.priority,
        location: job.location,
        summary: job.summary,
        notes: job.notes,
      }}
      onSubmit={async (values) => {
        await requestJson(`/api/jobs/${job.id}`, {
          method: "PATCH",
          role,
          body: { action: "update", ...values },
        });
        router.push(`/jobs/${job.id}`);
      }}
    />
  );
}

export function EditJobPageClient({ job }: EditJobPageClientProps) {
  return (
    <RoutePermissionGuard
      table="jobs"
      action="update"
      deniedDescription="You don't have permission to edit jobs."
    >
      <EditJobFormContent job={job} />
    </RoutePermissionGuard>
  );
}
