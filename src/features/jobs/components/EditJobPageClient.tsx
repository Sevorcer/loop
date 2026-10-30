"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { RoutePermissionGuard } from "@/components/atlas";
import { useCurrentRole } from "@/features/auth";
import { useCustomerPropertyOptions } from "@/features/jobs/hooks/useCustomerPropertyOptions";
import { requestJson } from "@/lib/api/client";
import { listFieldTechnicians } from "@/services/profileDirectory";

import { editJobIdentityValues } from "../utils/editJobInitialValues";
import type { Job } from "../types/job";
import { JobForm } from "./JobForm";

interface EditJobPageClientProps {
  job: Job;
}

import { jobToFormScheduling } from "./JobForm";

function EditJobFormContent({ job }: EditJobPageClientProps) {
  const router = useRouter();
  const { role } = useCurrentRole();

  const {
    customerOptions,
    propertyOptions,
    loadPropertiesForCustomer,
    searchCustomers,
    createCustomer,
    createProperty,
  } = useCustomerPropertyOptions(role);
  const [technicianProfiles, setTechnicianProfiles] = useState<{ id: string; name: string }[]>([]);
  const propertySearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!role) return;
    let cancelled = false;
    void listFieldTechnicians()
      .then((profiles) => {
        if (!cancelled) setTechnicianProfiles(profiles);
      })
      .catch(() => {
        if (!cancelled) setTechnicianProfiles([]);
      });
    return () => {
      cancelled = true;
    };
  }, [role]);
  const schedulingValues = jobToFormScheduling(job);

  return (
    <JobForm
      mode="edit"
      role={role ?? undefined}
      cancelHref={`/jobs/${job.id}`}
      initialValues={{
        ...editJobIdentityValues(job),
        ...schedulingValues,
      }}
      customerOptions={customerOptions}
      propertyOptions={propertyOptions} technicianProfiles={technicianProfiles}
      onCreateCustomer={createCustomer}
      onCreateProperty={async (input) => {
        const customerName = customerOptions.find((customer) => customer.id === input.customerId)?.name ?? job.customerName;
        return createProperty({ ...input, customerName });
      }}
      onCustomerSearch={searchCustomers}
      onPropertySearch={(text, customerId) => {
        if (propertySearchTimer.current) clearTimeout(propertySearchTimer.current);
        const query = text.trim();
        if (!customerId || !query) return;
        propertySearchTimer.current = setTimeout(() => {
          void loadPropertiesForCustomer(customerId, query);
        }, 300);
      }}
      onCustomerSelected={(customerId) => {
        void loadPropertiesForCustomer(customerId);
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
