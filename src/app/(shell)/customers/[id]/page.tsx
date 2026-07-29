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
    getCustomerJobs(id).catch((err: unknown) => {
      console.error("[customers/detail] job fetch failed – displaying page without job history", {
        customerId: id,
        error: err instanceof Error ? err.message : String(err),
      });
      return [] as Awaited<ReturnType<typeof getCustomerJobs>>;
    }),
  ]);

  if (!customer) {
    notFound();
  }

  const timelineState = await buildCustomerTimelineEvents({
    customer,
    properties,
    jobs,
  })
    .then((items) => ({ items, error: undefined }))
    .catch((error: unknown) => {
      console.error("[customers] failed to build customer timeline", {
        customerId: id,
        error,
      });
      return {
        items: [],
        error: "Timeline history is temporarily unavailable. Customer contact and property details remain available.",
      };
    });

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
