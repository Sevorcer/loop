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

import type { InstalledSystem, InstalledSystemLifecycle } from "../types/installedSystem";
import { useInstalledSystems } from "../state/InstalledSystemsProvider";

const LIFECYCLE_OPTIONS: InstalledSystemLifecycle[] = ["Planned", "Active", "Needs Review"];

interface FormValues {
  systemName: string;
  customerName: string;
  propertyName: string;
  location: string;
  installDate: string;
  lifecycleStatus: InstalledSystemLifecycle;
}

function toFormValues(system?: InstalledSystem): FormValues {
  return {
    systemName: system?.systemName ?? "",
    customerName: system?.customerName ?? "",
    propertyName: system?.propertyName ?? "",
    location: system?.location ?? "",
    installDate: system?.installDate ?? new Date().toISOString().split("T")[0],
    lifecycleStatus: system?.lifecycleStatus ?? "Planned",
  };
}

interface InstalledSystemFormProps {
  system?: InstalledSystem;
}

export function InstalledSystemForm({ system }: InstalledSystemFormProps) {
  const router = useRouter();
  const { role } = useCurrentRole();
  const { refreshSystems } = useInstalledSystems();
  const [form, setForm] = useState<FormValues>(toFormValues(system));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isEdit = Boolean(system);
  const cancelHref = isEdit
    ? ROUTE_BUILDERS.INSTALLED_SYSTEM_DETAIL(system!.id)
    : ROUTES.INSTALLED_SYSTEMS;

  const canSubmit =
    form.systemName.trim().length > 0 &&
    form.customerName.trim().length > 0 &&
    form.propertyName.trim().length > 0;

  function updateField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
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

      if (isEdit && system) {
        await requestJson(`/api/installed-systems/${system.id}`, {
          method: "PATCH",
          role,
          body: {
            systemName: form.systemName.trim(),
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
              customerName: form.customerName.trim(),
              propertyName: form.propertyName.trim(),
              location: form.location.trim(),
              installDate: form.installDate,
              lifecycleStatus: form.lifecycleStatus,
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
            </div>

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
            </div>

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
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Location</label>
              <input
                value={form.location}
                onChange={(e) => updateField("location", e.target.value)}
                placeholder="Rooftop – North Wing"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-blue-500/40"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Install Date</label>
              <input
                type="date"
                value={form.installDate}
                onChange={(e) => updateField("installDate", e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-blue-500/40"
              />
            </div>

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
