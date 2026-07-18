import { notFound } from "next/navigation";

import AppShell from "@/components/layout/AppShell";
import { CustomerDetailScreen } from "@/features/customers";
import { mockCustomers } from "@/features/customers/data/mockCustomers";

interface CustomerDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function CustomerDetailPage({
  params,
}: CustomerDetailPageProps) {
  const { id } = await params;

  const customer = mockCustomers.find((entry) => entry.id === id);

  if (!customer) {
    notFound();
  }

  return (
    <AppShell>
      <CustomerDetailScreen customer={customer} />
    </AppShell>
  );
}