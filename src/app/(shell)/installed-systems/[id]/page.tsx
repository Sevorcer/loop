import { notFound } from "next/navigation";

import { InstalledSystemDetailScreen } from "@/features/installed-systems/components/InstalledSystemDetailScreen";
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

  return <InstalledSystemDetailScreen installedSystem={result.data} />;
}
