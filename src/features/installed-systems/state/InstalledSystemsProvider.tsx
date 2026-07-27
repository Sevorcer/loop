"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useCurrentRole } from "@/features/auth";
import { requestJson } from "@/lib/api/client";

import { equipmentCatalog } from "../data/equipmentCatalog";
import { estimateEquipmentBundles } from "../data/estimateEquipmentBundles";
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
  loading: boolean;
  getInstalledSystemById: (id: string) => InstalledSystem | undefined;
  getInstalledSystemsForJob: (jobId: string) => InstalledSystem[];
  getTechnicalProfileById: (id: string) => TechnicalProfile | undefined;
  getCatalogEntryById: (id: string) => EquipmentCatalogEntry | undefined;
  refreshSystems: () => Promise<void>;
}

const InstalledSystemsContext =
  createContext<InstalledSystemsContextValue | null>(null);

export function InstalledSystemsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { role } = useCurrentRole();
  const [installedSystems, setInstalledSystems] = useState<InstalledSystem[]>([]);
  const [technicalProfiles, setTechnicalProfiles] = useState<TechnicalProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshSystems = useCallback(async () => {
    if (!role) return;

    setLoading(true);
    try {
      const snapshot = await requestJson<{
        installedSystems: InstalledSystem[];
        technicalProfiles: TechnicalProfile[];
      }>("/api/installed-systems", { role, cache: "no-store" });

      setInstalledSystems(snapshot.installedSystems ?? []);
      setTechnicalProfiles(snapshot.technicalProfiles ?? []);
    } catch {
      // Supabase not configured or network failure — start empty.
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    if (!role) return;
    // queueMicrotask defers the setState calls out of the synchronous effect
    // body, satisfying the react-hooks/set-state-in-effect lint rule.
    // This is the same pattern used by PropertiesProvider, CustomersProvider,
    // and JobsProvider throughout this codebase.
    queueMicrotask(() => {
      void refreshSystems();
    });
  }, [role, refreshSystems]);

  const value = useMemo<InstalledSystemsContextValue>(() => {
    function getInstalledSystemById(id: string) {
      return installedSystems.find((system) => system.id === id);
    }

    function getInstalledSystemsForJob(jobId: string) {
      return installedSystems.filter(
        (system) =>
          system.jobId === jobId || system.linkedWorkflowIds.includes(jobId)
      );
    }

    function getTechnicalProfileById(id: string) {
      return technicalProfiles.find((profile) => profile.id === id);
    }

    function getCatalogEntryById(id: string) {
      return equipmentCatalog.find((entry) => entry.id === id);
    }

    return {
      catalogEntries: equipmentCatalog,
      estimateBundles: estimateEquipmentBundles,
      installedSystems,
      technicalProfiles,
      loading,
      getInstalledSystemById,
      getInstalledSystemsForJob,
      getTechnicalProfileById,
      getCatalogEntryById,
      refreshSystems,
    };
  }, [installedSystems, technicalProfiles, loading, refreshSystems]);

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
