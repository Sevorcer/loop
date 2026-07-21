import { notFound } from "next/navigation";

import { RoutePermissionGuard } from "@/components/atlas";
import { CustomerEditForm } from "@/features/customers/components/CustomerEditForm";
import { getCustomer } from "@/services/customers";

interface EditCustomerPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditCustomerPage({ params }: EditCustomerPageProps) {
  const { id } = await params;
  const customer = await getCustomer(id);

  if (!customer) {
    notFound();
  }

  return (
    <RoutePermissionGuard
      table="customers"
      action="update"
      deniedDescription="You don't have permission to edit customers."
    >
      <CustomerEditForm customer={customer} />
    </RoutePermissionGuard>
  );
}
