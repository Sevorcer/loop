"use client";

import { useState } from "react";
import { BellRing, Siren, Activity } from "lucide-react";

import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";

import { VehicleAlertTable } from "../components/VehicleAlertTable";
import { mockVehicleAlerts } from "../data/mockVehicleAlerts";
import type { VehicleAlertPriority, VehicleAlertStatus } from "../types/vehicleAlert";

interface NewVehicleAlertFormValues {
  vehicleName: string;
  title: string;
  description: string;
  reportedBy: string;
  priority: VehicleAlertPriority;
}

const defaultFormValues: NewVehicleAlertFormValues = {
  vehicleName: "",
  title: "",
  description: "",
  reportedBy: "",
  priority: "Medium",
};

export function VehicleAlertsScreen() {
  const [alerts, setAlerts] = useState(mockVehicleAlerts);
  const [isReportFormOpen, setIsReportFormOpen] = useState(false);
  const [form, setForm] = useState<NewVehicleAlertFormValues>(defaultFormValues);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const canSubmit =
    form.vehicleName.trim().length > 0 &&
    form.title.trim().length > 0 &&
    form.description.trim().length > 0 &&
    form.reportedBy.trim().length > 0;

  function updateField<K extends keyof NewVehicleAlertFormValues>(
    key: K,
    value: NewVehicleAlertFormValues[K]
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
    setSubmitError(null);
  }

  function closeReportForm() {
    setIsReportFormOpen(false);
    setForm(defaultFormValues);
    setSubmitError(null);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!canSubmit) {
      setSubmitError("Complete all required fields before reporting an alert.");
      return;
    }

    const now = new Date();

    setAlerts((current) => [
      {
        id: `VA-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        vehicleName: form.vehicleName.trim(),
        title: form.title.trim(),
        description: form.description.trim(),
        priority: form.priority,
        status: "New",
        reportedBy: form.reportedBy.trim(),
        reportedAt: now.toISOString().slice(0, 10),
      },
      ...current,
    ]);
    closeReportForm();
  }

  function handleUpdateStatus(id: string, status: VehicleAlertStatus) {
    setAlerts((current) =>
      current.map((alert) =>
        alert.id === id ? { ...alert, status } : alert
      )
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <SurfaceCard className="overflow-hidden">
        <div className="flex flex-col gap-3 p-4 sm:gap-6 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2 sm:space-y-3">
            <div className="hidden items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-red-300 sm:inline-flex">
              <Siren className="h-3.5 w-3.5" />
              Fleet Response
            </div>

            <div>
              <h2 className="text-lg font-semibold tracking-tight text-white sm:text-2xl">
                Vehicle Alerts
              </h2>
              <p className="mt-1 hidden max-w-2xl text-sm leading-6 text-slate-400 sm:block">
                Track installer-reported vehicle issues, maintenance reminders,
                and office follow-up items in one place.
              </p>
            </div>
          </div>

          <Button
            className="w-full gap-2 border border-red-500/20 bg-gradient-to-r from-red-500/80 to-red-600 text-white hover:from-red-500 hover:to-red-700 sm:w-auto"
            onClick={() => setIsReportFormOpen((current) => !current)}
          >
            <BellRing className="h-4 w-4" />
            {isReportFormOpen ? "Close Report Form" : "Report Alert"}
          </Button>
        </div>
      </SurfaceCard>

      {isReportFormOpen ? (
        <SurfaceCard className="overflow-hidden">
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">
                  Vehicle
                </label>
                <input
                  value={form.vehicleName}
                  onChange={(e) => updateField("vehicleName", e.target.value)}
                  placeholder="Install Van 4"
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-red-500/40"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">
                  Priority
                </label>
                <select
                  value={form.priority}
                  onChange={(e) =>
                    updateField("priority", e.target.value as VehicleAlertPriority)
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-red-500/40"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <label className="text-sm font-medium text-slate-200">
                  Alert Title
                </label>
                <input
                  value={form.title}
                  onChange={(e) => updateField("title", e.target.value)}
                  placeholder="Rear tire leaking slowly"
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-red-500/40"
                  required
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <label className="text-sm font-medium text-slate-200">
                  Alert Details
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  rows={3}
                  placeholder="Describe what happened and what needs follow-up."
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-red-500/40"
                  required
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <label className="text-sm font-medium text-slate-200">
                  Reported By
                </label>
                <input
                  value={form.reportedBy}
                  onChange={(e) => updateField("reportedBy", e.target.value)}
                  placeholder="Luis M."
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-red-500/40"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              {submitError ? (
                <p className="text-sm text-red-300">{submitError}</p>
              ) : (
                <div />
              )}
              <div className="flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-slate-300 hover:text-white"
                  onClick={closeReportForm}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={!canSubmit}>
                  Submit Alert
                </Button>
              </div>
            </div>
          </form>
        </SurfaceCard>
      ) : null}

      <SurfaceCard className="overflow-hidden">
        <div className="border-b border-white/10 px-4 py-3 sm:px-6 sm:py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-red-500/15 to-blue-500/10 ring-1 ring-white/10 sm:h-11 sm:w-11 sm:rounded-2xl">
              <Activity className="h-4 w-4 text-red-300 sm:h-5 sm:w-5" />
            </div>

            <div>
              <h3 className="text-base font-semibold text-white sm:text-lg">
                Operations Alert Board
              </h3>
              <p className="mt-0.5 hidden text-sm text-slate-400 sm:block">
                Review new vehicle issues, acknowledge them, and track follow-up
                across the fleet.
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          <VehicleAlertTable alerts={alerts} onUpdateStatus={handleUpdateStatus} />
        </div>
      </SurfaceCard>
    </div>
  );
}