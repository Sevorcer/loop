import { notFound } from "next/navigation";

import { CustomerDetailScreen } from "@/features/customers";
import { getCustomer, getCustomerJobs, getCustomerProperties } from "@/services/customers";
import { buildCustomerTimelineEvents } from "@/services/timeline";

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

  const timelineState = await buildCustomerTimelineEvents({
    customer,
    properties,
    jobs,
  })
    .then((items) => ({ items, error: undefined as string | undefined }))
    .catch(() => ({
      items: [],
      error: "Timeline history is temporarily unavailable. Core customer details remain available.",
    }));

  return (
    <CustomerDetailScreen
      customer={customer}
      properties={properties}
      jobs={jobs}
      timelineItems={timelineState.items}
      timelineError={timelineState.error}
    />
  );
}
