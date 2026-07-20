"use client";

import { notFound } from "next/navigation";

import { CustomerDetailScreen } from "@/features/customers";
import { useCustomers } from "@/features/customers/state/CustomersProvider";

interface CustomerDetailClientProps {
  id: string;
}

export function CustomerDetailClient({ id }: CustomerDetailClientProps) {
  const { customers, loading, hydrated, error } = useCustomers();

  if (loading || !hydrated) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-sm text-slate-400">
        Loading customer details...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-200">
        {error}
      </div>
    );
  }

  const customer = customers.find((entry) => entry.id === id);

  if (!customer) {
    notFound();
  }

  return <CustomerDetailScreen customer={customer} />;
}
