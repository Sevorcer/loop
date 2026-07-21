import "server-only";

<<<<<<< HEAD
/**
 * Installed systems service — Sprint 27 #58
 *
 * Wraps the installed_systems repository for use in server-side paths.
 * Replaces direct seedInstalledSystems imports in production paths.
 */

import {
  getInstalledSystemById,
  listInstalledSystems,
} from "@/repositories/installedSystems";
import type { InstalledSystemRecord } from "@/repositories/installedSystems";

export type { InstalledSystemRecord };

export async function getInstalledSystems(filter?: {
  propertyId?: string;
  jobId?: string;
}): Promise<InstalledSystemRecord[]> {
  return listInstalledSystems(filter);
}

export async function getInstalledSystem(id: string): Promise<InstalledSystemRecord | null> {
  return getInstalledSystemById(id);
=======
import {
  loadInstalledSystemsSnapshot,
  type InstalledSystemsRepositorySnapshot,
} from "@/repositories/installedSystems";

export async function getInstalledSystemsSnapshot(): Promise<InstalledSystemsRepositorySnapshot> {
  return loadInstalledSystemsSnapshot();
>>>>>>> origin/main
}
