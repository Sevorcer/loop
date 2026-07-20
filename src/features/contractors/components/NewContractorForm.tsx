"use client";

import { useState } from "react";
import { CheckCircle2, HardHat } from "lucide-react";
import Link from "next/link";

import { RoutePermissionGuard } from "@/components/atlas";
import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";

import { useContractors } from "../state/ContractorsProvider";
import type { ContractorTrade, CreateContractorInput } from "../types/contractor";

const tradeOptions: Array<ContractorTrade | ""> = [
  "",
  "HVAC",
  "Electrical",
  "Plumbing",
  "Roofing",
  "General",
  "Other",
];

interface ContractorFormValues {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  trade: ContractorTrade | "";
}

const defaultValues: ContractorFormValues = {
  companyName: "",
  contactName: "",
  email: "",
  phone: "",
  trade: "",
};

function normalizeValues(v: ContractorFormValues): ContractorFormValues {
  return {
    companyName: v.companyName.trim(),
    contactName: v.contactName.trim(),
    email: v.email.trim(),
    phone: v.phone.trim(),
    trade: v.trade,
  };
}

export function NewContractorForm() {
  return (
    <RoutePermissionGuard
      table="contractors"
      action="insert"
      deniedDescription="You don't have permission to add contractors."
    >
      <NewContractorFormContent />
    </RoutePermissionGuard>
  );
}

function NewContractorFormContent() {
  const { createContractor } = useContractors();

  const [form, setForm] = useState<ContractorFormValues>(defaultValues);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const canSubmit =
    form.companyName.trim().length > 0 &&
    form.contactName.trim().length > 0 &&
    form.email.trim().length > 0;

  function updateField<K extends keyof ContractorFormValues>(
    key: K,
    value: ContractorFormValues[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const normalized = normalizeValues(form);

    const input: CreateContractorInput = {
      companyName: normalized.companyName,
      contactName: normalized.contactName,
      email: normalized.email,
      phone: normalized.phone,
      trade: normalized.trade,
    };

    const result = createContractor(input);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setIsSubmitted(true);
  }

  if (isSubmitted) {
    return (
      <SurfaceCard className="mx-auto max-w-3xl">
        <div className="space-y-4 p-8 text-center">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/30">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white">
              Contractor Added
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              The contractor has been added to your directory.
            </p>
          </div>

          <div className="flex flex-col items-center gap-3 pt-2 sm:flex-row sm:justify-center">
            <Link href={ROUTES.CONTRACTORS}>
              <Button variant="secondary" className="w-full sm:w-auto">
                View All Contractors
              </Button>
            </Link>

            <Button
              onClick={() => {
                setForm(defaultValues);
                setError(null);
                setIsSubmitted(false);
              }}
              className="w-full border border-red-500/20 bg-gradient-to-r from-red-500/80 to-blue-600 text-white hover:from-red-500 hover:to-blue-700 sm:w-auto"
            >
              Add Another
            </Button>
          </div>
        </div>
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard className="mx-auto max-w-3xl">
      <div className="border-b border-white/10 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-red-500/15 to-blue-500/10 ring-1 ring-white/10">
            <HardHat className="h-4 w-4 text-red-300" />
          </div>

          <div>
            <h2 className="text-base font-semibold text-white">
              Add Contractor
            </h2>
            <p className="mt-0.5 text-sm text-slate-400">
              Add an external contractor to assign to jobs.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="grid gap-5 px-6 py-6 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <label className="text-sm font-medium text-slate-200">
              Company Name <span className="text-red-400">*</span>
            </label>
            <input
              value={form.companyName}
              onChange={(e) => updateField("companyName", e.target.value)}
              placeholder="Arctic Air Solutions"
              className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-blue-500/40"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-200">
              Contact Name <span className="text-red-400">*</span>
            </label>
            <input
              value={form.contactName}
              onChange={(e) => updateField("contactName", e.target.value)}
              placeholder="James Herrera"
              className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-blue-500/40"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-200">
              Email <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => updateField("email", e.target.value)}
              placeholder="james@arcticair.com"
              className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-blue-500/40"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-200">Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              placeholder="206-555-0101"
              className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-blue-500/40"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-200">Trade</label>
            <select
              value={form.trade}
              onChange={(e) =>
                updateField("trade", e.target.value as ContractorTrade | "")
              }
              className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-blue-500/40"
            >
              {tradeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt === "" ? "Select trade (optional)" : opt}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error ? (
          <div className="mx-6 mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 border-t border-white/10 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href={ROUTES.CONTRACTORS}>
            <Button
              type="button"
              variant="ghost"
              className="w-full text-slate-400 hover:text-white sm:w-auto"
            >
              Cancel
            </Button>
          </Link>

          <Button
            type="submit"
            disabled={!canSubmit}
            className="w-full gap-2 border border-red-500/20 bg-gradient-to-r from-red-500/80 to-blue-600 text-white hover:from-red-500 hover:to-blue-700 disabled:opacity-50 sm:w-auto"
          >
            <HardHat className="h-4 w-4" />
            Add Contractor
          </Button>
        </div>
      </form>
    </SurfaceCard>
  );
}
