"use client";

import { notFound } from "next/navigation";

import { CustomerDetailScreen } from "@/features/customers";
import { useCustomers } from "@/features/customers/state/CustomersProvider";

interface CustomerDetailClientProps {
  id: string;
}

export function CustomerDetailClient({ id }: CustomerDetailClientProps) {
  const { hydrated, customers } = useCustomers();
  const customer = customers.find((entry) => entry.id === id);

  if (!hydrated) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 text-sm text-slate-400">
        Loading customer details...
      </div>
    );
  }

  if (!customer) {
    notFound();
  }

  return <CustomerDetailScreen customer={customer} />;
}
