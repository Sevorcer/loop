import "server-only";

import {
  loadInstalledSystemsSnapshot,
  type InstalledSystemsRepositorySnapshot,
} from "@/repositories/installedSystems";

export async function getInstalledSystemsSnapshot(): Promise<InstalledSystemsRepositorySnapshot> {
  return loadInstalledSystemsSnapshot();
}
