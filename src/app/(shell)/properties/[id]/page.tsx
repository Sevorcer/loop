import { notFound } from "next/navigation";

import { PropertyDetailScreen } from "@/features/properties";
import type { CustomerPropertyItem } from "@/features/customers/types/customerDetails";
import { getCustomer, getCustomerProperties } from "@/services/customers";
import { listJobsForProperty } from "@/services/jobs";
import { getInstalledSystemsForProperty } from "@/services/installedSystems";
import { getProperty } from "@/services/properties";

interface PropertyDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function PropertyDetailPage({ params }: PropertyDetailPageProps) {
  const { id } = await params;

  const property = await getProperty(id);

  if (!property) {
    notFound();
  }

  const [jobs, installedSystems, customerAndProperties] = await Promise.all([
    listJobsForProperty(id),
    getInstalledSystemsForProperty(id).catch(() => []),
    property.customerId
      ? Promise.all([
          getCustomer(property.customerId),
          getCustomerProperties(property.customerId),
        ])
      : Promise.resolve([null, [] as CustomerPropertyItem[]] as const),
  ]);

  const [customer, customerProperties] = customerAndProperties;

  return (
    <PropertyDetailScreen
      property={property}
      customer={customer}
      customerProperties={customerProperties}
      jobs={jobs}
      installedSystems={installedSystems}
    />
  );
}
