import { InstalledSystemEditPageClient } from "@/features/installed-systems/components/InstalledSystemEditPageClient";
import { loadSystemSerials } from "@/features/installed-systems/server/loadSystemSerials";
import { getInstalledSystemSerials } from "@/repositories/installedSystems";

export default async function EditInstalledSystemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let unitSerials: string[] | undefined;
  try {
    // Units are the source of truth; the form starts from them, not the mirrored list.
    unitSerials = await loadSystemSerials(id, (await getInstalledSystemSerials(id)) ?? []);
  } catch {
    unitSerials = undefined;
  }
  return <InstalledSystemEditPageClient id={id} unitSerials={unitSerials} />;
}
