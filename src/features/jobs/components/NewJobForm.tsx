"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { RoutePermissionGuard } from "@/components/atlas";
import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";
import { useCurrentRole } from "@/features/auth";
import { useCustomerPropertyOptions } from "@/features/jobs/hooks/useCustomerPropertyOptions";
import { requestJson } from "@/lib/api/client";
import { listFieldTechnicians } from "@/services/profileDirectory";
import { ROUTES } from "@/lib/routes";

import type { Crew } from "@/features/dispatch/types/dispatch";
import {
  buildTechnicianSuggestions,
  resolveInitialSmartSelection,
} from "@/features/jobs/utils/smartJobCreation";

import { canSeeJobRevenue } from "@/features/reporting/utils/revenueAccess";
import { parseDollarsToCents } from "@/lib/money";

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
  const [priceDraft, setPriceDraft] = useState("");
  const [priceNote, setPriceNote] = useState<string | null>(null);
  const [createdFromEstimate, setCreatedFromEstimate] = useState(false);
  const {
    customerOptions,
    propertyOptions,
    ready: hasLoadedOptions,
    error: smartLoadError,
    loadPropertiesForCustomer,
    searchCustomers,
    createCustomer,
    createProperty,
  } = useCustomerPropertyOptions(role);

  const propertySearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlePropertyServerSearch = (text: string, customerId?: string) => {
    if (propertySearchTimer.current) clearTimeout(propertySearchTimer.current);
    const query = text.trim();
    if (!query || !role || !customerId) return;
    propertySearchTimer.current = setTimeout(() => {
      void loadPropertiesForCustomer(customerId, query).catch((error) => {
        console.error("[jobs] property server search failed", error);
      });
    }, 300);
  };

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
    if (!role) return;
    void requestJson<{ crews: Crew[] }>("/api/crews", { role })
      .then((crewsResponse) => {
        setCrewTechnicians(
          (crewsResponse.crews ?? []).flatMap((crew) => [
            crew.leadInstaller,
            ...crew.members.map((member) => member.name),
          ]),
        );
      })
      .catch((error) => {
        console.error("[jobs] failed to load crews", error);
        setCrewTechnicians([]);
      });
  }, [role]);
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

  const prefilledValues = useMemo(() => {
    if (!initialContext) {
      return undefined;
    }
    const initialized = resolveInitialSmartSelection(
      customerOptions,
      propertyOptions,
      initialContext,
    );
    if (Object.keys(initialized.formPatch).length === 0 && !initialized.state.customerId) {
      return undefined;
    }
    return {
      ...initialized.formPatch,
      customerId: initialized.state.customerId ?? null,
      propertyId: initialized.state.propertyId ?? null,
    };
  }, [customerOptions, initialContext, propertyOptions]);

  async function handleSubmit(values: JobFormValues) {
    const parsed = canSeeJobRevenue(role) ? parseDollarsToCents(priceDraft) : { ok: true as const, cents: null };
    if (!parsed.ok) {
      throw new Error(parsed.message);
    }
    const job = await createJob(values);
    if (canSeeJobRevenue(role) && parsed.cents != null) {
      try {
        await requestJson(`/api/jobs/${job.id}/price`, {
          method: "PUT",
          role,
          body: { amount: priceDraft },
        });
        setPriceNote(null);
      } catch (error) {
        setPriceNote(error instanceof Error ? error.message : "The job was created, but the price was not saved.");
      }
    }
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
            {priceNote ? <p className="mt-3 text-sm text-amber-200">{priceNote}</p> : null}
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

  const priceFields = canSeeJobRevenue(role) ? (
    <label className="block space-y-2 text-sm text-slate-200" htmlFor="new-job-price">
      <span className="font-medium">
        Job price <span className="text-slate-500">(optional)</span>
      </span>
      <input
        id="new-job-price"
        inputMode="decimal"
        value={priceDraft}
        onChange={(event) => setPriceDraft(event.target.value)}
        placeholder="0.00"
        className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-red-500/40"
      />
      <span className="block text-xs text-slate-500">Dollars and cents. You can change it later on the job.</span>
    </label>
  ) : null;

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
        priceFields={priceFields}
        onSubmit={handleSubmit}
        onCreateCustomer={createCustomer}
        onCreateProperty={async (input) => {
          const customerName = customerOptions.find((customer) => customer.id === input.customerId)?.name ?? "";
          const property = await createProperty({ ...input, customerName });
          return property;
        }}
        onCustomerSearch={searchCustomers}
        onPropertySearch={handlePropertyServerSearch}
        onCustomerSelected={(customerId) => {
          void loadPropertiesForCustomer(customerId);
        }}
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
