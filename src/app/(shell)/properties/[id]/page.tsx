import { notFound } from "next/navigation";

import { PropertyDetailScreen } from "@/features/properties";
import { mockProperties } from "@/features/properties/data/mockProperties";

interface PropertyDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function PropertyDetailPage({
  params,
}: PropertyDetailPageProps) {
  const { id } = await params;

  const property = mockProperties.find((entry) => entry.id === id);

  if (!property) {
    notFound();
  }

  return <PropertyDetailScreen property={property} />;
}
