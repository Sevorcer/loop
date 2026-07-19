"use client";

import { notFound } from "next/navigation";

import { useInstalledSystems } from "../state/InstalledSystemsProvider";
import { InstalledSystemDetailScreen } from "./InstalledSystemDetailScreen";

export function InstalledSystemDetailPageClient({ id }: { id: string }) {
  const { getInstalledSystemById } = useInstalledSystems();

  const installedSystem = getInstalledSystemById(id);

  if (!installedSystem) {
    notFound();
  }

  return <InstalledSystemDetailScreen installedSystem={installedSystem} />;
}
