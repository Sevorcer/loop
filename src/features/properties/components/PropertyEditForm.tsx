"use client";

import { useState } from "react";
import { Pencil, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";
import { requestJson } from "@/lib/api/client";
import { useCurrentRole } from "@/features/auth";
import { ROUTE_BUILDERS } from "@/lib/routes";

import type { Property, PropertyStatus, PropertyType } from "../types/property";

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

function toFormValues(property: Property): PropertyFormValues {
  return {
    name: property.name,
    customer: property.customer,
    address: property.address,
    city: property.city,
    type: property.type,
    status: property.status,
    primarySystem: property.primarySystem,
  };
}

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

interface PropertyEditFormProps {
  property: Property;
}

export function PropertyEditForm({ property }: PropertyEditFormProps) {
  const router = useRouter();
  const { role } = useCurrentRole();
  const [form, setForm] = useState<PropertyFormValues>(toFormValues(property));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const detailHref = ROUTE_BUILDERS.PROPERTY_DETAIL(property.id);

  const canSubmit =
    form.name.trim().length > 0 &&
    form.customer.trim().length > 0 &&
    form.address.trim().length > 0 &&
    form.city.trim().length > 0;

  function updateField<K extends keyof PropertyFormValues>(key: K, value: PropertyFormValues[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!canSubmit) {
      setError("Complete all required fields before saving.");
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      await requestJson(`/api/properties/${property.id}`, {
        method: "PATCH",
        role,
        body: normalizeValues(form),
      });
      router.push(detailHref);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update property. Please try again.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <SurfaceCard className="overflow-hidden">
        <div className="flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">
              <Pencil className="h-3.5 w-3.5" />
              Edit Property
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                {property.name}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Update the service location details. Address changes will trigger
                a background geocode update.
              </p>
            </div>
          </div>

          <Link href={detailHref}>
            <Button variant="ghost" className="text-slate-300 hover:text-white">
              Cancel
            </Button>
          </Link>
        </div>
      </SurfaceCard>

      <form onSubmit={handleSubmit}>
        <SurfaceCard>
          <div className="grid gap-6 p-6 lg:grid-cols-2">
            <div className="space-y-2 lg:col-span-2">
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
              <label className="text-sm font-medium text-slate-200">Customer Name</label>
              <input
                value={form.customer}
                onChange={(e) => updateField("customer", e.target.value)}
                placeholder="Northside Retail Group"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-blue-500/40"
                required
              />
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
              <label className="text-sm font-medium text-slate-200">Primary System</label>
              <input
                value={form.primarySystem}
                onChange={(e) => updateField("primarySystem", e.target.value)}
                placeholder="Mitsubishi Hyper Heat"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-blue-500/40"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-white/10 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            {error ? <p className="text-sm text-red-300">{error}</p> : <div />}
            <div className="flex items-center justify-end gap-3">
              <Link href={detailHref}>
                <Button
                  type="button"
                  variant="ghost"
                  className="text-slate-300 hover:text-white"
                >
                  Cancel
                </Button>
              </Link>

              <Button type="submit" className="gap-2" disabled={!canSubmit || isSaving}>
                <Save className="h-4 w-4" />
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </SurfaceCard>
      </form>
    </div>
  );
}
