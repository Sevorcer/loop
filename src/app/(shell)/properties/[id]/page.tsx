import { notFound } from "next/navigation";

import { PropertyDetailScreen } from "@/features/properties";
import { getCustomer, getCustomerProperties } from "@/services/customers";
import { listInstalledSystemsForProperty } from "@/services/installedSystems";
import { listJobsForProperty } from "@/services/jobs";
import { getProperty } from "@/services/properties";
import { buildPropertyTimelineEvents } from "@/services/timeline";

interface PropertyDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function PropertyDetailPage({ params }: PropertyDetailPageProps) {
  const { id } = await params;

  const property = await getProperty(id);

  if (!property) {
    notFound();
  }

  const [jobs, installedSystems] = await Promise.all([
    listJobsForProperty(id),
    listInstalledSystemsForProperty(id),
  ]);

  const [customer, customerProperties] = property.customerId
    ? await Promise.all([
        getCustomer(property.customerId),
        getCustomerProperties(property.customerId),
      ])
    : [null, []];

  const timelineState = await buildPropertyTimelineEvents({
    property,
    jobs,
    installedSystems,
  })
    .then((items) => ({ items, error: undefined as string | undefined }))
    .catch(() => ({
      items: [],
      error: "Property timeline history is temporarily unavailable. Property details remain available.",
    }));

  return (
    <PropertyDetailScreen
      property={property}
      customer={customer}
      customerProperties={customerProperties}
      jobs={jobs}
      installedSystems={installedSystems}
      timelineItems={timelineState.items}
      timelineError={timelineState.error}
    />
  );
}
