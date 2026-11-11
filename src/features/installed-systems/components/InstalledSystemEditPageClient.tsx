"use client";

import { notFound } from "next/navigation";

import { PermissionGuard } from "@/components/atlas";
import { InstalledSystemForm } from "./InstalledSystemForm";
import { useInstalledSystems } from "../state/InstalledSystemsProvider";

export function InstalledSystemEditPageClient({ id, unitSerials }: { id: string; unitSerials?: string[] }) {
  const { getInstalledSystemById } = useInstalledSystems();
  const system = getInstalledSystemById(id);

  if (!system) {
    notFound();
  }

  return (
    <PermissionGuard table="installed_systems" action="update">
      <InstalledSystemForm system={unitSerials ? { ...system, serialNumbers: unitSerials } : system} />
    </PermissionGuard>
  );
}
