"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { RoutePermissionGuard } from "@/components/atlas";
import { useCurrentRole } from "@/features/auth";
import { requestJson } from "@/lib/api/client";
import type { Customer } from "@/features/customers/types/customer";
import type { Property } from "@/features/properties/types/property";

import type { Job } from "../types/job";
import { JobForm } from "./JobForm";

interface EditJobPageClientProps {
  job: Job;
}

import { jobToFormScheduling } from "./JobForm";

function EditJobFormContent({ job }: EditJobPageClientProps) {
  const router = useRouter();
  const { role } = useCurrentRole();

  // F18: the edit form shares JobForm's customer/property pickers, so it
  // needs the same option lists the create form loads.
  const [customerOptions, setCustomerOptions] = useState<Customer[]>([]);
  const [propertyOptions, setPropertyOptions] = useState<Property[]>([]);

  useEffect(() => {
    if (!role) {
      return;
    }
    void Promise.all([
      requestJson<{ customers: Customer[] }>("/api/customers", { role }),
      requestJson<{ properties: Property[] }>("/api/properties", { role }),
    ])
      .then(([customerResponse, propertyResponse]) => {
        setCustomerOptions(customerResponse.customers ?? []);
        setPropertyOptions(propertyResponse.properties ?? []);
      })
      .catch((error) => {
        console.error("[jobs] failed to load edit-job picker options", error);
      });
  }, [role]);

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
      customerOptions={customerOptions}
      propertyOptions={propertyOptions}
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
