import { Briefcase } from "lucide-react";

import { PageHeader } from "@/components/atlas/PageHeader";
import { EmptyState } from "@/components/atlas/EmptyState";

export function JobsAdminScreen() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Jobs"
        description="Create, edit, and manage job records (v1 fields). Full CRUD arriving in S29-040."
      />
      <EmptyState
        icon={<Briefcase size={20} />}
        title="Jobs"
        description="Job management will be available here. CRUD implementation arriving in S29-040."
      />
    </div>
  );
}
