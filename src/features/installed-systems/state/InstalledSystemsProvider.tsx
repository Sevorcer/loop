"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

import { useJobs } from "@/features/jobs/state/JobsProvider";

import { buildInstalledSystemsSnapshot, estimateEquipmentBundles } from "../utils/installedSystemsUtils";
import type {
  EquipmentCatalogEntry,
  EstimateEquipmentBundle,
  InstalledSystem,
  TechnicalProfile,
} from "../types/installedSystem";

interface InstalledSystemsContextValue {
  catalogEntries: EquipmentCatalogEntry[];
  estimateBundles: EstimateEquipmentBundle[];
  installedSystems: InstalledSystem[];
  technicalProfiles: TechnicalProfile[];
  getInstalledSystemById: (id: string) => InstalledSystem | undefined;
  getInstalledSystemsForJob: (jobId: string) => InstalledSystem[];
  getTechnicalProfileById: (id: string) => TechnicalProfile | undefined;
  getCatalogEntryById: (id: string) => EquipmentCatalogEntry | undefined;
}

const InstalledSystemsContext =
  createContext<InstalledSystemsContextValue | null>(null);

export function InstalledSystemsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { jobs } = useJobs();

  const value = useMemo<InstalledSystemsContextValue>(() => {
    const snapshot = buildInstalledSystemsSnapshot(jobs);

    function getInstalledSystemById(id: string) {
      return snapshot.installedSystems.find((system) => system.id === id);
    }

    function getInstalledSystemsForJob(jobId: string) {
      return snapshot.installedSystems.filter(
        (system) =>
          system.jobId === jobId || system.linkedWorkflowIds.includes(jobId)
      );
    }

    function getTechnicalProfileById(id: string) {
      return snapshot.technicalProfiles.find((profile) => profile.id === id);
    }

    function getCatalogEntryById(id: string) {
      return snapshot.catalogEntries.find((entry) => entry.id === id);
    }

    return {
      ...snapshot,
      estimateBundles: estimateEquipmentBundles,
      getInstalledSystemById,
      getInstalledSystemsForJob,
      getTechnicalProfileById,
      getCatalogEntryById,
    };
  }, [jobs]);

  return (
    <InstalledSystemsContext.Provider value={value}>
      {children}
    </InstalledSystemsContext.Provider>
  );
}

export function useInstalledSystems() {
  const context = useContext(InstalledSystemsContext);

  if (!context) {
    throw new Error(
      "useInstalledSystems must be used within an InstalledSystemsProvider"
    );
  }

  return context;
}
