import { PageHeader } from "@/components/atlas/PageHeader";
import { OrganizationsManager } from "../components/organizations/OrganizationsManager";

export function OrganizationsScreen() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Organizations"
        description="Manage platform organizations with search, pagination, and full mutation controls."
      />
      <OrganizationsManager />
    </div>
  );
}
