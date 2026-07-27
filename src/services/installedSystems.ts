import "server-only";

import type {
  InstalledSystem,
} from "@/features/installed-systems/types/installedSystem";
import {
  deleteInstalledSystem as repoDeleteInstalledSystem,
  getInstalledSystemById,
  loadInstalledSystemsSnapshot,
  upsertInstalledSystem,
  type InstalledSystemsRepositorySnapshot,
  type InstalledSystemWriteInput,
} from "@/repositories/installedSystems";

export async function getInstalledSystemsSnapshot(): Promise<InstalledSystemsRepositorySnapshot> {
  return loadInstalledSystemsSnapshot();
}

export async function listInstalledSystemsForProperty(propertyId: string): Promise<InstalledSystem[]> {
  const snapshot = await loadInstalledSystemsSnapshot();
  return snapshot.installedSystems.filter((system) => system.propertyId === propertyId);
}

export async function createInstalledSystem(
  input: InstalledSystemWriteInput,
): Promise<InstalledSystem> {
  const result = await upsertInstalledSystem(undefined, input);
  if (!result.ok) throw new Error(result.error.message);
  return result.data;
}

export async function updateInstalledSystem(
  id: string,
  input: Partial<InstalledSystemWriteInput>,
): Promise<InstalledSystem | null> {
  const current = await getInstalledSystemById(id);
  if (!current.ok) throw new Error(current.error.message);
  if (!current.data) return null;

  const merged: InstalledSystemWriteInput = {
    technicalIdentityId: input.technicalIdentityId ?? current.data.technicalIdentityId,
    technicalProfileId: input.technicalProfileId ?? current.data.technicalProfileId,
    systemName: input.systemName ?? current.data.systemName,
    lifecycleStatus: input.lifecycleStatus ?? current.data.lifecycleStatus,
    customerName: input.customerName ?? current.data.customerName,
    propertyId: input.propertyId ?? current.data.propertyId,
    propertyName: input.propertyName ?? current.data.propertyName,
    location: input.location ?? current.data.location,
    estimateId: input.estimateId ?? current.data.estimateId,
    jobId: input.jobId ?? current.data.jobId,
    jobNumber: input.jobNumber ?? current.data.jobNumber,
    matchState: input.matchState ?? current.data.matchState,
    matchConfidence: input.matchConfidence ?? current.data.matchConfidence,
    installDate: input.installDate ?? current.data.installDate,
    serialNumbers: input.serialNumbers ?? current.data.serialNumbers,
    accessories: input.accessories ?? current.data.accessories,
    linkedWorkflowIds: input.linkedWorkflowIds ?? current.data.linkedWorkflowIds,
    permitReady: input.permitReady ?? current.data.permitReady,
    operationalHistory: input.operationalHistory ?? current.data.operationalHistory,
  };

  const result = await upsertInstalledSystem(id, merged);
  if (!result.ok) throw new Error(result.error.message);
  return result.data;
}

export async function deleteInstalledSystem(id: string): Promise<boolean> {
  const result = await repoDeleteInstalledSystem(id);
  if (!result.ok) throw new Error(result.error.message);
  return result.data;
}
