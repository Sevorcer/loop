import { RoutePermissionGuard } from "@/components/atlas";
import { InstalledSystemForm } from "@/features/installed-systems/components/InstalledSystemForm";

export default function NewInstalledSystemPage() {
  return (
    <RoutePermissionGuard
      table="installed_systems"
      action="insert"
      deniedDescription="You don't have permission to create installed systems."
    >
      <InstalledSystemForm />
    </RoutePermissionGuard>
  );
}
