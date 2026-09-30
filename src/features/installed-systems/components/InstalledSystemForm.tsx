"use client";

import { useState } from "react";
import { Cpu, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";
import { requestJson } from "@/lib/api/client";
import { useCurrentRole } from "@/features/auth";
import { ROUTES, ROUTE_BUILDERS } from "@/lib/routes";
import { todayLocalISODate } from "@/lib/dates";

import type { InstalledSystem, InstalledSystemLifecycle } from "../types/installedSystem";
import { useInstalledSystems } from "../state/InstalledSystemsProvider";

const LIFECYCLE_OPTIONS: InstalledSystemLifecycle[] = ["Planned", "Active", "Needs Review"];

interface FormValues {
  systemName: string;
  manufacturer: string;
  modelNumber: string;
  serialNumber: string;
  warrantyExpiry: string;
  customerName: string;
  propertyName: string;
  location: string;
  installDate: string;
  lifecycleStatus: InstalledSystemLifecycle;
}

function toFormValues(system?: InstalledSystem): FormValues {
  return {
    systemName: system?.systemName ?? "",
    manufacturer: system?.manufacturer ?? "",
    modelNumber: system?.modelNumber ?? "",
    serialNumber: system?.serialNumbers?.[0] ?? "",
    warrantyExpiry: system?.warrantyExpiry ?? "",
    customerName: system?.customerName ?? "",
    propertyName: system?.propertyName ?? "",
    location: system?.location ?? "",
    installDate: system?.installDate ?? todayLocalISODate(),
    lifecycleStatus: system?.lifecycleStatus ?? "Planned",
  };
}

export interface InstalledSystemFormContext {
  jobId?: string;
  jobNumber?: string;
  propertyId?: string;
  customerName?: string;
  propertyName?: string;
}

interface InstalledSystemFormProps {
  system?: InstalledSystem;
  context?: InstalledSystemFormContext;
}

export function InstalledSystemForm({ system, context }: InstalledSystemFormProps) {
  const router = useRouter();
  const { role } = useCurrentRole();
  const { refreshSystems } = useInstalledSystems();
  const [form, setForm] = useState<FormValues>(() => {
    const base = toFormValues(system);
    if (!system && context) {
      return {
        ...base,
        customerName: context.customerName ?? base.customerName,
        propertyName: context.propertyName ?? base.propertyName,
      };
    }
    return base;
  });
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [isSaving, setIsSaving] = useState(false);

  const isEdit = Boolean(system);
  const cancelHref = isEdit
    ? ROUTE_BUILDERS.INSTALLED_SYSTEM_DETAIL(system!.id)
    : ROUTES.INSTALLED_SYSTEMS;

  function isFormValid(f: FormValues): boolean {
    return (
      f.systemName.trim().length > 0 &&
      f.manufacturer.trim().length > 0 &&
      f.modelNumber.trim().length > 0 &&
      f.serialNumber.trim().length > 0 &&
      f.installDate.trim().length > 0 &&
      f.customerName.trim().length > 0 &&
      f.propertyName.trim().length > 0
    );
  }

  const canSubmit = isFormValid(form);

  function updateField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
  }

  function validate(): boolean {
    const errors: Partial<Record<keyof FormValues, string>> = {};
    if (!form.systemName.trim()) errors.systemName = "System name is required.";
    if (!form.manufacturer.trim()) errors.manufacturer = "Manufacturer is required.";
    if (!form.modelNumber.trim()) errors.modelNumber = "Model number is required.";
    if (!form.serialNumber.trim()) errors.serialNumber = "Serial number is required.";
    if (!form.installDate.trim()) errors.installDate = "Install date is required.";
    if (!form.customerName.trim()) errors.customerName = "Customer name is required.";
    if (!form.propertyName.trim()) errors.propertyName = "Property name is required.";
    setFieldErrors(errors);
    return isFormValid(form);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!validate()) {
      setError("Complete all required fields before saving.");
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      const serialNumbers = [form.serialNumber.trim()].filter(Boolean);

      if (isEdit && system) {
        await requestJson(`/api/installed-systems/${system.id}`, {
          method: "PATCH",
          role,
          body: {
            systemName: form.systemName.trim(),
            manufacturer: form.manufacturer.trim(),
            modelNumber: form.modelNumber.trim(),
            serialNumbers,
            warrantyExpiry: form.warrantyExpiry.trim(),
            customerName: form.customerName.trim(),
            propertyName: form.propertyName.trim(),
            location: form.location.trim(),
            installDate: form.installDate,
            lifecycleStatus: form.lifecycleStatus,
          },
        });
        await refreshSystems();
        router.push(ROUTE_BUILDERS.INSTALLED_SYSTEM_DETAIL(system.id));
      } else {
        const response = await requestJson<{ installedSystem: InstalledSystem }>(
          "/api/installed-systems",
          {
            method: "POST",
            role,
            body: {
              systemName: form.systemName.trim(),
              manufacturer: form.manufacturer.trim(),
              modelNumber: form.modelNumber.trim(),
              serialNumbers,
              warrantyExpiry: form.warrantyExpiry.trim(),
              customerName: form.customerName.trim(),
              propertyId: context?.propertyId,
              propertyName: form.propertyName.trim(),
              location: form.location.trim(),
              installDate: form.installDate,
              lifecycleStatus: form.lifecycleStatus,
              jobId: context?.jobId,
              jobNumber: context?.jobNumber,
            },
          },
        );
        await refreshSystems();
        router.push(ROUTE_BUILDERS.INSTALLED_SYSTEM_DETAIL(response.installedSystem.id));
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save. Please try again.",
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
              <Cpu className="h-3.5 w-3.5" />
              {isEdit ? "Edit System" : "New Installed System"}
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                {isEdit ? system!.systemName : "Create Installed System"}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                {isEdit
                  ? "Update system details. Technical profile and catalog matching are managed separately."
                  : "Register a new installed system. Technical profile and catalog matching will be configured after creation."}
              </p>
            </div>

            {context?.jobNumber ? (
              <p className="text-sm text-slate-400">
                Linked to job{" "}
                <span className="font-medium text-slate-200">{context.jobNumber}</span>
              </p>
            ) : null}
          </div>

          <Link href={cancelHref}>
            <Button variant="ghost" className="text-slate-300 hover:text-white">
              Cancel
            </Button>
          </Link>
        </div>
      </SurfaceCard>

      <form onSubmit={handleSubmit}>
        <SurfaceCard>
          <div className="grid gap-6 p-6 lg:grid-cols-2">
            {/* System Name */}
            <div className="space-y-2 lg:col-span-2">
              <label className="text-sm font-medium text-slate-200">
                System Name <span className="text-red-400">*</span>
              </label>
              <input
                value={form.systemName}
                onChange={(e) => updateField("systemName", e.target.value)}
                placeholder="Mitsubishi Hyper Heat – Unit A"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-blue-500/40"
                required
              />
              {fieldErrors.systemName ? (
                <p className="text-xs text-red-400">{fieldErrors.systemName}</p>
              ) : null}
            </div>

            {/* Manufacturer */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">
                Manufacturer <span className="text-red-400">*</span>
              </label>
              <input
                value={form.manufacturer}
                onChange={(e) => updateField("manufacturer", e.target.value)}
                placeholder="Mitsubishi, Daikin, Carrier…"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-blue-500/40"
                required
              />
              {fieldErrors.manufacturer ? (
                <p className="text-xs text-red-400">{fieldErrors.manufacturer}</p>
              ) : null}
            </div>

            {/* Model Number */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">
                Model Number <span className="text-red-400">*</span>
              </label>
              <input
                value={form.modelNumber}
                onChange={(e) => updateField("modelNumber", e.target.value)}
                placeholder="MXZ-3C24NAHZ2"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-blue-500/40"
                required
              />
              {fieldErrors.modelNumber ? (
                <p className="text-xs text-red-400">{fieldErrors.modelNumber}</p>
              ) : null}
            </div>

            {/* Serial Number */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">
                Serial Number <span className="text-red-400">*</span>
              </label>
              <input
                value={form.serialNumber}
                onChange={(e) => updateField("serialNumber", e.target.value)}
                placeholder="SN-2024-001234"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-blue-500/40"
                required
              />
              {fieldErrors.serialNumber ? (
                <p className="text-xs text-red-400">{fieldErrors.serialNumber}</p>
              ) : null}
            </div>

            {/* Install Date */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">
                Install Date <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={form.installDate}
                onChange={(e) => updateField("installDate", e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-blue-500/40"
                required
              />
              {fieldErrors.installDate ? (
                <p className="text-xs text-red-400">{fieldErrors.installDate}</p>
              ) : null}
            </div>

            {/* Warranty Expiry */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Warranty Expiry</label>
              <input
                type="date"
                value={form.warrantyExpiry}
                onChange={(e) => updateField("warrantyExpiry", e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-blue-500/40"
              />
            </div>

            {/* Customer Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">
                Customer Name <span className="text-red-400">*</span>
              </label>
              <input
                value={form.customerName}
                onChange={(e) => updateField("customerName", e.target.value)}
                placeholder="Northside Retail Group"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-blue-500/40"
                required
              />
              {fieldErrors.customerName ? (
                <p className="text-xs text-red-400">{fieldErrors.customerName}</p>
              ) : null}
            </div>

            {/* Property Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">
                Property Name <span className="text-red-400">*</span>
              </label>
              <input
                value={form.propertyName}
                onChange={(e) => updateField("propertyName", e.target.value)}
                placeholder="Northside Plaza"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-blue-500/40"
                required
              />
              {fieldErrors.propertyName ? (
                <p className="text-xs text-red-400">{fieldErrors.propertyName}</p>
              ) : null}
            </div>

            {/* Location */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Location</label>
              <input
                value={form.location}
                onChange={(e) => updateField("location", e.target.value)}
                placeholder="Rooftop – North Wing"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-blue-500/40"
              />
            </div>

            {/* Lifecycle Status */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Lifecycle Status</label>
              <select
                value={form.lifecycleStatus}
                onChange={(e) =>
                  updateField("lifecycleStatus", e.target.value as InstalledSystemLifecycle)
                }
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-blue-500/40"
              >
                {LIFECYCLE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-white/10 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            {error ? <p className="text-sm text-red-300">{error}</p> : <div />}
            <div className="flex items-center justify-end gap-3">
              <Link href={cancelHref}>
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
                {isSaving ? "Saving..." : isEdit ? "Save Changes" : "Create System"}
              </Button>
            </div>
          </div>
        </SurfaceCard>
      </form>
    </div>
  );
}
