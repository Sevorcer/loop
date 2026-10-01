"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { RoutePermissionGuard } from "@/components/atlas";
import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";
import { useCurrentRole } from "@/features/auth";
import type { Customer } from "@/features/customers/types/customer";
import type { Property } from "@/features/properties/types/property";
import { requestJson } from "@/lib/api/client"; import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { ROUTES } from "@/lib/routes";

import type { Crew } from "@/features/dispatch/types/dispatch";
import {
  buildTechnicianSuggestions,
  resolveInitialSmartSelection,
} from "@/features/jobs/utils/smartJobCreation";

import { JobForm, type JobFormValues } from "./JobForm";
import { useJobs } from "../state/JobsProvider";
import type { SmartSelectionState } from "../utils/smartJobCreation";

interface NewJobFormProps {
  initialContext?: SmartSelectionState;
}

function NewJobFormContent({ initialContext }: NewJobFormProps) {
  const router = useRouter();
  const { role } = useCurrentRole();
  const { jobs, createJob } = useJobs();
  

  const [submittedJobId, setSubmittedJobId] = useState<string | null>(null);
  const [createdFromEstimate, setCreatedFromEstimate] = useState(false);
  const [customerOptions, setCustomerOptions] = useState<Customer[]>([]);
  const [propertyOptions, setPropertyOptions] = useState<Property[]>([]);
  const [hasLoadedOptions, setHasLoadedOptions] = useState(false);
  const [smartLoadError, setSmartLoadError] = useState<string | null>(null);

  const [crewTechnicians, setCrewTechnicians] = useState<string[]>([]); const [technicianProfiles, setTechnicianProfiles] = useState<{ id: string; name: string }[]>([]);

  const technicianOptions = useMemo(
    () =>
      buildTechnicianSuggestions([
        ...crewTechnicians,
        ...jobs.map((job) => job.assignedTo),
        
      ]),
    [crewTechnicians, jobs],
  );

  useEffect(() => {
    if (!role) {
      return;
    }
    void Promise.all([
      requestJson<{ customers: Customer[] }>("/api/customers", { role }),
      requestJson<{ properties: Property[] }>("/api/properties", { role }),
      requestJson<{ crews: Crew[] }>("/api/crews", { role }),
    ])
      .then(([customerResponse, propertyResponse, crewsResponse]) => {
        setCustomerOptions(customerResponse.customers);
        setPropertyOptions(propertyResponse.properties);
        setCrewTechnicians(
          (crewsResponse.crews ?? []).flatMap((crew) => [
            crew.leadInstaller,
            ...crew.members.map((member) => member.name),
          ]),
        );
        setSmartLoadError(null);
        setHasLoadedOptions(true);
      })
      .catch((error) => {
        console.error("[jobs] failed to load smart creation options", error);
        setCustomerOptions([]);
        setPropertyOptions([]);
        setCrewTechnicians([]);
        setSmartLoadError("Customer and property pickers are temporarily unavailable. Reload the page and try again before saving.");
        setHasLoadedOptions(true);
      });
  }, [role]); useEffect(() => { if (!role) { return; } let cancelled = false; void (async () => { try { const supabase = getSupabaseBrowserClient(); const { data, error } = await supabase.from("user_profiles").select("id, full_name, email").eq("app_role", "tech"); if (!cancelled && !error) { setTechnicianProfiles(((data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>).map((profile) => ({ id: profile.id, name: (profile.full_name ?? "").trim() || (profile.email ?? "").trim() || "Team member" })).sort((a, b) => a.name.localeCompare(b.name))); } } catch { if (!cancelled) { setTechnicianProfiles([]); } } })(); return () => { cancelled = true; }; }, [role]);

  const prefilledValues = useMemo(() => {
    if (!initialContext) {
      return undefined;
    }
    const initialized = resolveInitialSmartSelection(
      customerOptions,
      propertyOptions,
      initialContext,
    );
    if (Object.keys(initialized.formPatch).length === 0) {
      return undefined;
    }
    return initialized.formPatch;
  }, [customerOptions, initialContext, propertyOptions]);

  async function handleSubmit(values: JobFormValues) {
    const job = await createJob(values);
    setSubmittedJobId(job.id);
    setCreatedFromEstimate(Boolean(job.estimateId && job.equipmentBundleId));
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
            {createdFromEstimate ? (
              <p className="mt-3 text-sm leading-6 text-blue-200">
                LOOP also established the installed system&apos;s technical
                identity so permit-ready data can inherit from the technical
                profile instead of being re-entered later.
              </p>
            ) : null}
          </div>

          <div className="flex justify-center gap-3">
          <Link href={ROUTES.JOBS}>
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

  if (role && !hasLoadedOptions) {
    return (
      <SurfaceCard className="mx-auto max-w-3xl p-8 text-center text-sm text-slate-400">
        Loading scheduling context...
      </SurfaceCard>
    );
  }

  return (
    <div className="space-y-4">
      {smartLoadError ? (
        <SurfaceCard className="p-4 text-sm text-amber-200">{smartLoadError}</SurfaceCard>
      ) : null}
      <JobForm
        mode="create"
        cancelHref={ROUTES.JOBS}
        initialValues={prefilledValues}
        customerOptions={customerOptions}
        propertyOptions={propertyOptions}
        technicianOptions={technicianOptions} technicianProfiles={technicianProfiles}
        onSubmit={handleSubmit}
      />
    </div>
  );
}

export function NewJobForm({ initialContext }: NewJobFormProps) {
  return (
    <RoutePermissionGuard
      table="jobs"
      action="insert"
      deniedDescription="You don't have permission to create jobs."
    >
      <NewJobFormContent initialContext={initialContext} />
    </RoutePermissionGuard>
  );
}
