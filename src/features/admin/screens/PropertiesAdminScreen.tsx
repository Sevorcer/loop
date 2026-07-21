import { MapPin } from "lucide-react";

import { PageHeader } from "@/components/atlas/PageHeader";
import { EmptyState } from "@/components/atlas/EmptyState";

export function PropertiesAdminScreen() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Properties"
        description="Create, edit, and manage property records. Full CRUD arriving in S29-030."
      />
      <EmptyState
        icon={<MapPin size={20} />}
        title="Properties"
        description="Property management will be available here. CRUD implementation arriving in S29-030."
      />
    </div>
  );
}
