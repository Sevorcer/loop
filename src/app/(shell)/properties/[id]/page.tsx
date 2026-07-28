import { notFound } from "next/navigation";

import { PropertyDetailScreen } from "@/features/properties";
import type { CustomerPropertyItem } from "@/features/customers/types/customerDetails";
import { getCustomer, getCustomerProperties } from "@/services/customers";
import { listInstalledSystemsForProperty } from "@/services/installedSystems";
import { listJobsForProperty } from "@/services/jobs";
import { getInstalledSystemsForProperty } from "@/services/installedSystems";
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

<<<<<<< HEAD
  const [jobs, installedSystems, customerAndProperties] = await Promise.all([
    listJobsForProperty(id),
    getInstalledSystemsForProperty(id).catch(() => []),
    property.customerId
      ? Promise.all([
          getCustomer(property.customerId),
          getCustomerProperties(property.customerId),
        ])
      : Promise.resolve([null, [] as CustomerPropertyItem[]] as const),
=======
  const [jobs, installedSystems] = await Promise.all([
    listJobsForProperty(id),
    listInstalledSystemsForProperty(id),
>>>>>>> origin/main
  ]);

  const [customer, customerProperties] = customerAndProperties;

  const timelineState = await buildPropertyTimelineEvents({
    property,
    jobs,
    installedSystems,
  })
    .then((items) => ({ items, error: undefined }))
    .catch((error: unknown) => {
      console.error("[properties] failed to build property timeline", {
        propertyId: id,
        error,
      });
      return {
        items: [],
        error: "Property timeline history is temporarily unavailable. Basic property details and linked records remain available.",
      };
    });

  return (
    <PropertyDetailScreen
      property={property}
      customer={customer}
      customerProperties={customerProperties}
      jobs={jobs}
      installedSystems={installedSystems}
<<<<<<< HEAD
=======
      timelineItems={timelineState.items}
      timelineError={timelineState.error}
>>>>>>> origin/main
    />
  );
}
