import { RoutePermissionGuard } from "@/components/atlas";
import {
  InstalledSystemForm,
  type InstalledSystemFormContext,
} from "@/features/installed-systems/components/InstalledSystemForm";

interface NewInstalledSystemPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function NewInstalledSystemPage({
  searchParams,
}: NewInstalledSystemPageProps) {
  const params = await searchParams;

  function str(v: string | string[] | undefined): string | undefined {
    if (typeof v === "string" && v.trim()) return v.trim();
    return undefined;
  }

  const context: InstalledSystemFormContext = {
    jobId: str(params.jobId),
    jobNumber: str(params.jobNumber),
    propertyId: str(params.propertyId),
    customerName: str(params.customerName),
    propertyName: str(params.propertyName),
  };

  return (
    <RoutePermissionGuard
      table="installed_systems"
      action="insert"
      deniedDescription="You don't have permission to create installed systems."
    >
      <InstalledSystemForm context={context} />
    </RoutePermissionGuard>
  );
}
