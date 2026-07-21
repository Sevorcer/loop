import { notFound } from "next/navigation";

import { CustomerDetailScreen } from "@/features/customers";
import { getCustomer, getCustomerJobs, getCustomerProperties } from "@/services/customers";

interface CustomerDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  const { id } = await params;

  const [customer, properties, jobs] = await Promise.all([
    getCustomer(id),
    getCustomerProperties(id),
    getCustomerJobs(id),
  ]);

  if (!customer) {
    notFound();
  }

  return <CustomerDetailScreen customer={customer} properties={properties} jobs={jobs} />;
}
