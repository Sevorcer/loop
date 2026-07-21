import { Users } from "lucide-react";

import { PageHeader } from "@/components/atlas/PageHeader";
import { EmptyState } from "@/components/atlas/EmptyState";

export function CustomersAdminScreen() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Create, edit, and manage customer records. Full CRUD arriving in S29-020."
      />
      <EmptyState
        icon={<Users size={20} />}
        title="Customers"
        description="Customer management will be available here. CRUD implementation arriving in S29-020."
      />
    </div>
  );
}
