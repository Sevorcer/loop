import { Building } from "lucide-react";

import { PageHeader } from "@/components/atlas/PageHeader";
import { EmptyState } from "@/components/atlas/EmptyState";

export function OrganizationsScreen() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Organizations"
        description="Manage platform organizations. Create and edit operations are restricted to platform administrators."
      />
      <EmptyState
        icon={<Building size={20} />}
        title="Organizations"
        description="Organization management will be available here. CRUD implementation arriving in S29-010."
      />
    </div>
  );
}
