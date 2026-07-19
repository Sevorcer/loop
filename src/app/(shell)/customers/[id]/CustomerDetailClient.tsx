"use client";

import { notFound } from "next/navigation";

import { CustomerDetailScreen } from "@/features/customers";
import { useCustomers } from "@/features/customers/state/CustomersProvider";

interface CustomerDetailClientProps {
  id: string;
}

export function CustomerDetailClient({ id }: CustomerDetailClientProps) {
  const { customers } = useCustomers();
  const customer = customers.find((entry) => entry.id === id);

  if (!customer) {
    notFound();
  }

  return <CustomerDetailScreen customer={customer} />;
}
