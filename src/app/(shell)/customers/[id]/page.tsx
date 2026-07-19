import { notFound } from "next/navigation";

import { CustomerDetailScreen } from "@/features/customers";
import { mockCustomers } from "@/features/customers/data/mockCustomers";

interface CustomerDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CustomerDetailPage({
  params,
}: CustomerDetailPageProps) {
  const { id } = await params;
  const customer = mockCustomers.find((entry) => entry.id === id);
  if (!customer) notFound();
  return <CustomerDetailScreen customer={customer} />;
}
