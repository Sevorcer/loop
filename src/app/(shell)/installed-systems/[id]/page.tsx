import { notFound } from "next/navigation";

import { InstalledSystemDetailScreen } from "@/features/installed-systems/components/InstalledSystemDetailScreen";
import { loadSystemSerials } from "@/features/installed-systems/server/loadSystemSerials";
import { getInstalledSystemById } from "@/repositories/installedSystems";

export default async function InstalledSystemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const result = await getInstalledSystemById(id);

  if (!result.ok || !result.data) {
    notFound();
  }

  const serialNumbers = await loadSystemSerials(result.data.id, result.data.serialNumbers);

  return <InstalledSystemDetailScreen installedSystem={{ ...result.data, serialNumbers }} />;
}
