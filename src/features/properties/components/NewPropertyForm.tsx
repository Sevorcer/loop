"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, CheckCircle2, ClipboardPlus } from "lucide-react";
import Link from "next/link";

import { RoutePermissionGuard } from "@/components/atlas";
import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";
import { useCurrentRole } from "@/features/auth";
import type { Customer } from "@/features/customers/types/customer";
import { requestJson } from "@/lib/api/client";
import { ROUTES } from "@/lib/routes";

import { useProperties } from "../state/PropertiesProvider";
import type { PropertyStatus, PropertyType } from "../types/property";

const propertyTypes: PropertyType[] = ["Residential", "Commercial", "Multi-Family"];
const propertyStatuses: PropertyStatus[] = ["Active", "Pending", "Inactive"];

interface PropertyFormValues {
  name: string;
  customer: string;
  address: string;
  city: string;
  type: PropertyType;
  status: PropertyStatus;
  primarySystem: string;
}

const defaultPropertyFormValues: PropertyFormValues = {
  name: "",
  customer: "",
  address: "",
  city: "",
  type: "Residential",
  status: "Active",
  primarySystem: "",
};

function normalizeValues(values: PropertyFormValues): PropertyFormValues {
  return {
    ...values,
    name: values.name.trim(),
    customer: values.customer.trim(),
    address: values.address.trim(),
    city: values.city.trim(),
    primarySystem: values.primarySystem.trim(),
  };
}

export function NewPropertyForm({ initialCustomerId }: { initialCustomerId?: string }) {
  return (
    <RoutePermissionGuard
      table="properties"
      action="insert"
      deniedDescription="You don't have permission to create properties."
    >
      <NewPropertyFormContent initialCustomerId={initialCustomerId} />
    </RoutePermissionGuard>
  );
}

function NewPropertyFormContent({ initialCustomerId }: { initialCustomerId?: string }) {
  const { createProperty } = useProperties();
  const { role } = useCurrentRole();

  const [form, setForm] = useState<PropertyFormValues>(defaultPropertyFormValues);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [customerOptions, setCustomerOptions] = useState<Customer[]>([]);
  const [customerLoadError, setCustomerLoadError] = useState(false);
  const [customerRetryCount, setCustomerRetryCount] = useState(0);

  // F6: customer picker instead of free text — typo-proof linking.
  // F21 hardening: a failed customer fetch used to leave the dropdown with
  // only the placeholder and no explanation, so the Create button stayed
  // disabled with no visible reason. Surface the failure with a retry.
  useEffect(() => {
    if (!role) return;
    let cancelled = false;

    async function loadCustomers() {
      setCustomerLoadError(false);
      try {
        const res = await requestJson<{ customers: Customer[] }>("/api/customers", {
          role,
        });
        if (!cancelled) {
          setCustomerOptions(res.customers ?? []);
        }
      } catch {
        if (!cancelled) {
          setCustomerOptions([]);
          setCustomerLoadError(true);
        }
      }
    }

    void loadCustomers();

    return () => {
      cancelled = true;
    };
  }, [role, customerRetryCount]);

  // F5: prefill the customer when arriving from a customer page (?customerId=).
  // The select is name-valued but the URL carries the id, so resolve the id
  // to a name once the options load. Derived during render (not setState in
  // an effect): an explicit user choice in form.customer always wins.
  const prefilledCustomerName = useMemo(() => {
    if (!initialCustomerId || form.customer) return "";
    return (
      customerOptions.find((customer) => customer.id === initialCustomerId)?.name ?? ""
    );
  }, [initialCustomerId, customerOptions, form.customer]);

  const effectiveCustomer = form.customer || prefilledCustomerName;

  // F7: Primary System is no longer required — the office often doesn't know
  // the equipment yet at property creation time.
  const canSubmit =
    form.name.trim().length > 0 &&
    effectiveCustomer.trim().length > 0 &&
    form.address.trim().length > 0 &&
    form.city.trim().length > 0;

  function updateField<K extends keyof PropertyFormValues>(
    key: K,
    value: PropertyFormValues[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!canSubmit) {
      setError("Complete all required fields before saving this property.");
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      await createProperty({
        ...normalizeValues(form),
        customer: effectiveCustomer.trim(),
      });
      setIsSubmitted(true);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Failed to create property. Please verify the address and try again.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isSubmitted) {
    return (
      <SurfaceCard className="mx-auto max-w-3xl">
        <div className="space-y-4 p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-500/15 to-blue-500/10 ring-1 ring-white/10">
            <CheckCircle2 className="h-7 w-7 text-emerald-300" />
          </div>

          <div>
            <h1 className="text-2xl font-semibold text-white">Property created</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Your new property is now available in the Property Directory for
              filtering, search, and routing into downstream workflows.
            </p>
          </div>

          <div className="flex justify-center gap-3">
            <Link href={ROUTES.PROPERTIES}>
              <Button variant="secondary">View Property Directory</Button>
            </Link>

            <Button
              onClick={() => {
                setIsSubmitted(false);
                setForm(defaultPropertyFormValues);
              }}
            >
              Create Another
            </Button>
          </div>
        </div>
      </SurfaceCard>
    );
  }

  return (
    <div className="space-y-6">
      <SurfaceCard className="overflow-hidden">
        <div className="flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">
              <ClipboardPlus className="h-3.5 w-3.5" />
              New Workflow Entry
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                Create Property
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Capture a new service location and make it available to office and
                field workflows.
              </p>
            </div>
          </div>

          <Link href={ROUTES.PROPERTIES}>
            <Button variant="ghost" className="text-slate-300 hover:text-white">
              Back to Properties
            </Button>
          </Link>
        </div>
      </SurfaceCard>

      <form onSubmit={handleSubmit}>
        <SurfaceCard>
          <div className="grid gap-6 p-6 lg:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Property Name</label>
              <input
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="Northside Plaza"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-blue-500/40"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Customer</label>
              <select
                value={effectiveCustomer}
                onChange={(e) => updateField("customer", e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-blue-500/40"
                required
              >
                <option value="">Select a customer…</option>
                {customerOptions.map((customer) => (
                  <option key={customer.id} value={customer.name}>
                    {customer.name}
                  </option>
                ))}
                {effectiveCustomer &&
                !customerOptions.some((customer) => customer.name === effectiveCustomer) ? (
                  <option value={effectiveCustomer}>{effectiveCustomer}</option>
                ) : null}
              </select>
              {customerLoadError ? (
                <p className="text-xs text-red-300">
                  Couldn&apos;t load customers — check your connection, then{" "}
                  <button
                    type="button"
                    className="underline underline-offset-2 hover:text-red-200"
                    onClick={() => setCustomerRetryCount((count) => count + 1)}
                  >
                    retry
                  </button>
                  .
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Address</label>
              <input
                value={form.address}
                onChange={(e) => updateField("address", e.target.value)}
                placeholder="1450 Northside Blvd"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-blue-500/40"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">City</label>
              <input
                value={form.city}
                onChange={(e) => updateField("city", e.target.value)}
                placeholder="Seattle"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-blue-500/40"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Property Type</label>
              <select
                value={form.type}
                onChange={(e) => updateField("type", e.target.value as PropertyType)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-blue-500/40"
              >
                {propertyTypes.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Lifecycle Status</label>
              <select
                value={form.status}
                onChange={(e) => updateField("status", e.target.value as PropertyStatus)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-blue-500/40"
              >
                {propertyStatuses.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 lg:col-span-2">
              <label className="text-sm font-medium text-slate-200">
                Primary System <span className="text-slate-500">(optional)</span>
              </label>
              <input
                value={form.primarySystem}
                onChange={(e) => updateField("primarySystem", e.target.value)}
                placeholder="Mitsubishi Hyper Heat — leave blank if unknown"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-blue-500/40"
              />
              <p className="text-xs text-slate-500">
                Optional — add it later from the property page once the equipment is known.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-white/10 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            {error ? <p className="text-sm text-red-300">{error}</p> : <div />}
            <div className="flex items-center justify-end gap-3">
              <Link href={ROUTES.PROPERTIES}>
                <Button
                  type="button"
                  variant="ghost"
                  className="text-slate-300 hover:text-white"
                >
                  Cancel
                </Button>
              </Link>

              <Button type="submit" className="gap-2" disabled={!canSubmit || isSaving}>
                <Building2 className="h-4 w-4" />
                {isSaving ? "Creating..." : "Create Property"}
              </Button>
            </div>
          </div>
        </SurfaceCard>
      </form>
    </div>
  );
}
