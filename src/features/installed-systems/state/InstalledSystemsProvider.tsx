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
  InstalledSystemsCounts,
  TechnicalProfile,
} from "../types/installedSystem";

const EMPTY_COUNTS: InstalledSystemsCounts = {
  total: 0,
  activeWarranties: 0,
  expiringSoon: 0,
  expired: 0,
};

interface InstalledSystemsContextValue {
  catalogEntries: EquipmentCatalogEntry[];
  estimateBundles: EstimateEquipmentBundle[];
  installedSystems: InstalledSystem[];
  technicalProfiles: TechnicalProfile[];
  counts: InstalledSystemsCounts;
  loading: boolean;
  /** Non-null when the most recent load failed — distinct from an empty org. */
  error: string | null;
  getInstalledSystemById: (id: string) => InstalledSystem | undefined;
  getInstalledSystemsForJob: (
    jobId: string,
    propertyId?: string,
  ) => InstalledSystem[];
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
  const [counts, setCounts] = useState<InstalledSystemsCounts>(EMPTY_COUNTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const technicalProfilesById = useMemo(
    () => {
      const map = new Map<string, TechnicalProfile>();

      for (const technicalProfile of technicalProfiles) {
        map.set(technicalProfile.id, technicalProfile);
      }

      return map;
    },
    [technicalProfiles]
  );

  const refreshSystems = useCallback(async () => {
    if (!role) return;

    setLoading(true);
    setError(null);
    try {
      const snapshot = await requestJson<{
        installedSystems: InstalledSystem[];
        technicalProfiles: TechnicalProfile[];
        counts?: InstalledSystemsCounts;
      }>("/api/installed-systems", { role, cache: "no-store" });

      setInstalledSystems(snapshot.installedSystems ?? []);
      setTechnicalProfiles(snapshot.technicalProfiles ?? []);
      setCounts(snapshot.counts ?? EMPTY_COUNTS);
    } catch (caught) {
      // Surface the failure instead of silently collapsing into an empty
      // state — the UI must be able to tell "load failed" apart from
      // "this org genuinely has no systems".
      setInstalledSystems([]);
      setTechnicalProfiles([]);
      setCounts(EMPTY_COUNTS);
      setError(
        caught instanceof Error ? caught.message : "Failed to load installed systems.",
      );
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

    function getInstalledSystemsForJob(jobId: string, propertyId?: string) {
      return installedSystems.filter(
        (system) =>
          system.jobId === jobId ||
          system.linkedWorkflowIds.includes(jobId) ||
          // Job panels are strictly job-scoped: only this job's own systems.
          // Property fallback removed: it leaked other jobs' systems onto a job.
          // Only jobId / linkedWorkflowIds matches below count.
          (false &&
            propertyId !== "" &&
            system.propertyId === propertyId),
      );
    }

    function getTechnicalProfileById(id: string) {
      return technicalProfilesById.get(id);
    }

    function getCatalogEntryById(id: string) {
      return equipmentCatalog.find((entry) => entry.id === id);
    }

    return {
      catalogEntries: equipmentCatalog,
      estimateBundles: estimateEquipmentBundles,
      installedSystems,
      technicalProfiles,
      counts,
      loading,
      error,
      getInstalledSystemById,
      getInstalledSystemsForJob,
      getTechnicalProfileById,
      getCatalogEntryById,
      refreshSystems,
    };
  }, [installedSystems, technicalProfiles, technicalProfilesById, counts, loading, error, refreshSystems]);

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
