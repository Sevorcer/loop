import { notFound } from "next/navigation";

import { RoutePermissionGuard } from "@/components/atlas";
import { PropertyEditForm } from "@/features/properties/components/PropertyEditForm";
import { getProperty } from "@/services/properties";

interface EditPropertyPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditPropertyPage({ params }: EditPropertyPageProps) {
  const { id } = await params;
  const property = await getProperty(id);

  if (!property) {
    notFound();
  }

  return (
    <RoutePermissionGuard
      table="properties"
      action="update"
      deniedDescription="You don't have permission to edit properties."
    >
      <PropertyEditForm property={property} />
    </RoutePermissionGuard>
  );
}
