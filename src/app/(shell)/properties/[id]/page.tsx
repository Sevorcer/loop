import { notFound } from "next/navigation";

import { PropertyDetailScreen } from "@/features/properties";
import { getCustomer, getCustomerProperties } from "@/services/customers";
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

  const [customer, customerProperties] = property.customerId
    ? await Promise.all([
        getCustomer(property.customerId),
        getCustomerProperties(property.customerId),
      ])
    : [null, []];

  return (
    <PropertyDetailScreen
      property={property}
      customer={customer}
      customerProperties={customerProperties}
    />
  );
}
