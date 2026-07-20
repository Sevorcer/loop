"use client";

import { useState } from "react";
import { CheckCircle2, ClipboardPlus, UserPlus } from "lucide-react";
import Link from "next/link";

import { RoutePermissionGuard } from "@/components/atlas";
import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";

import { useCustomers } from "../state/CustomersProvider";
import type { CustomerStatus } from "../types/customer";

const customerStatuses: CustomerStatus[] = ["Active", "Prospect", "Inactive"];

interface CustomerFormValues {
  name: string;
  primaryContact: string;
  email: string;
  phone: string;
  city: string;
  status: CustomerStatus;
}

const defaultCustomerFormValues: CustomerFormValues = {
  name: "",
  primaryContact: "",
  email: "",
  phone: "",
  city: "",
  status: "Active",
};

function normalizeValues(values: CustomerFormValues): CustomerFormValues {
  return {
    ...values,
    name: values.name.trim(),
    primaryContact: values.primaryContact.trim(),
    email: values.email.trim(),
    phone: values.phone.trim(),
    city: values.city.trim(),
  };
}

export function NewCustomerForm() {
  return (
    <RoutePermissionGuard
      table="customers"
      action="insert"
      deniedDescription="You don't have permission to create customers."
    >
      <NewCustomerFormContent />
    </RoutePermissionGuard>
  );
}

function NewCustomerFormContent() {
  const { createCustomer } = useCustomers();

  const [form, setForm] = useState<CustomerFormValues>(defaultCustomerFormValues);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const canSubmit =
    form.name.trim().length > 0 &&
    form.primaryContact.trim().length > 0 &&
    form.email.trim().length > 0 &&
    form.city.trim().length > 0;

  function updateField<K extends keyof CustomerFormValues>(
    key: K,
    value: CustomerFormValues[K],
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
      setError("Complete all required fields before saving this customer.");
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      await createCustomer(normalizeValues(form));
      setIsSubmitted(true);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to create customer. Please check the form and try again.",
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
            <h1 className="text-2xl font-semibold text-white">Customer created</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Your new customer account is now available in the Customer
              Directory for filtering, search, and linking to properties and
              jobs.
            </p>
          </div>

          <div className="flex justify-center gap-3">
            <Link href={ROUTES.CUSTOMERS}>
              <Button variant="secondary">View Customer Directory</Button>
            </Link>

            <Button
              onClick={() => {
                setIsSubmitted(false);
                setForm(defaultCustomerFormValues);
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
                Create Customer
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Add a new customer account to the platform. Once created, you
                can link properties, schedule jobs, and track the full service
                relationship.
              </p>
            </div>
          </div>

          <Link href={ROUTES.CUSTOMERS}>
            <Button variant="ghost" className="text-slate-300 hover:text-white">
              Back to Customers
            </Button>
          </Link>
        </div>
      </SurfaceCard>

      <form onSubmit={handleSubmit}>
        <SurfaceCard>
          <div className="grid gap-6 p-6 lg:grid-cols-2">
            <div className="space-y-2 lg:col-span-2">
              <label className="text-sm font-medium text-slate-200">
                Account Name
              </label>
              <input
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="Smith Family or Northside Retail Group"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-blue-500/40"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">
                Primary Contact
              </label>
              <input
                value={form.primaryContact}
                onChange={(e) => updateField("primaryContact", e.target.value)}
                placeholder="John Smith"
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
              <label className="text-sm font-medium text-slate-200">
                Email Address
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                placeholder="contact@example.com"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-blue-500/40"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">
                Phone Number
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                placeholder="(555) 000-0000"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-blue-500/40"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">
                Account Status
              </label>
              <select
                value={form.status}
                onChange={(e) =>
                  updateField("status", e.target.value as CustomerStatus)
                }
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-blue-500/40"
              >
                {customerStatuses.map((option) => (
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
              <Link href={ROUTES.CUSTOMERS}>
                <Button
                  type="button"
                  variant="ghost"
                  className="text-slate-300 hover:text-white"
                >
                  Cancel
                </Button>
              </Link>

              <Button type="submit" className="gap-2" disabled={!canSubmit || isSaving}>
                <UserPlus className="h-4 w-4" />
                {isSaving ? "Creating..." : "Create Customer"}
              </Button>
            </div>
          </div>
        </SurfaceCard>
      </form>
    </div>
  );
}
