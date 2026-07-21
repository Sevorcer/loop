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

import type { Customer, CustomerStatus } from "../types/customer";

const customerStatuses: CustomerStatus[] = ["Active", "Prospect", "Inactive"];

interface CustomerFormValues {
  name: string;
  primaryContact: string;
  email: string;
  phone: string;
  city: string;
  status: CustomerStatus;
}

function toFormValues(customer: Customer): CustomerFormValues {
  return {
    name: customer.name,
    primaryContact: customer.primaryContact,
    email: customer.email,
    phone: customer.phone,
    city: customer.city,
    status: customer.status,
  };
}

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

interface CustomerEditFormProps {
  customer: Customer;
}

export function CustomerEditForm({ customer }: CustomerEditFormProps) {
  const router = useRouter();
  const { role } = useCurrentRole();
  const [form, setForm] = useState<CustomerFormValues>(toFormValues(customer));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const detailHref = ROUTE_BUILDERS.CUSTOMER_DETAIL(customer.id);

  const canSubmit =
    form.name.trim().length > 0 &&
    form.primaryContact.trim().length > 0 &&
    form.email.trim().length > 0 &&
    form.city.trim().length > 0;

  function updateField<K extends keyof CustomerFormValues>(key: K, value: CustomerFormValues[K]) {
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
      await requestJson(`/api/customers/${customer.id}`, {
        method: "PATCH",
        role,
        body: normalizeValues(form),
      });
      router.push(detailHref);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update customer. Please try again.",
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
              Edit Customer
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                {customer.name}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Update the account information for this customer. Changes will
                be reflected immediately across the platform.
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
              <label className="text-sm font-medium text-slate-200">Account Name</label>
              <input
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="Smith Family or Northside Retail Group"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-blue-500/40"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Primary Contact</label>
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
              <label className="text-sm font-medium text-slate-200">Email Address</label>
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
              <label className="text-sm font-medium text-slate-200">Phone Number</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                placeholder="(555) 000-0000"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-blue-500/40"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Account Status</label>
              <select
                value={form.status}
                onChange={(e) => updateField("status", e.target.value as CustomerStatus)}
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
