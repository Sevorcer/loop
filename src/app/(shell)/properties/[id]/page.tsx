import { notFound } from "next/navigation";

import { PropertyDetailScreen } from "@/features/properties";
import { getCustomer, getCustomerProperties } from "@/services/customers";
import { listJobsForProperty } from "@/services/jobs";
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

  const [customer, customerProperties, jobs] = property.customerId
    ? await Promise.all([
        getCustomer(property.customerId),
        getCustomerProperties(property.customerId),
        listJobsForProperty(id),
      ])
    : await Promise.all([
        Promise.resolve(null),
        Promise.resolve([]),
        listJobsForProperty(id),
      ]);

  return (
    <PropertyDetailScreen
      property={property}
      customer={customer}
      customerProperties={customerProperties}
      jobs={jobs}
    />
  );
}
