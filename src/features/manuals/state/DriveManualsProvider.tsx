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

import type { DriveManualFile, DriveManualSyncRun, DriveManualsSnapshot } from "../types/manuals";

interface DriveManualsContextValue {
  snapshot: DriveManualsSnapshot | null;
  loading: boolean;
  error: string | null;
  syncing: boolean;
  syncError: string | null;
  refresh: () => Promise<void>;
  sync: () => Promise<DriveManualSyncRun | null>;
  updateManual: (
    id: string,
    patch: { manufacturer?: string | null; model?: string | null },
  ) => Promise<DriveManualFile | null>;
}

const DriveManualsContext = createContext<DriveManualsContextValue | null>(null);

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/** Loads /api/manuals (Drive index) and exposes sync + override edits. */
export function DriveManualsProvider({ children }: { children: ReactNode }) {
  const { role } = useCurrentRole();
  const [snapshot, setSnapshot] = useState<DriveManualsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const fetchSnapshot = useCallback(async () => {
    if (!role) return null;
    try {
      const data = await requestJson<DriveManualsSnapshot>("/api/manuals", { role, cache: "no-store" });
      return { data, error: null as string | null };
    } catch (loadError) {
      return { data: null, error: messageOf(loadError, "Could not load Drive manuals.") };
    }
  }, [role]);

  const applyLoad = useCallback(
    (result: { data: DriveManualsSnapshot | null; error: string | null }) => {
      setSnapshot(result.data);
      setError(result.error);
      setLoading(false);
    },
    [],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await fetchSnapshot();
    if (result) applyLoad(result);
    else setLoading(false);
  }, [applyLoad, fetchSnapshot]);

  useEffect(() => {
    let cancelled = false;
    void fetchSnapshot().then((result) => {
      if (!cancelled && result) applyLoad(result);
    });
    return () => {
      cancelled = true;
    };
  }, [applyLoad, fetchSnapshot]);

  const sync = useCallback(async () => {
    if (!role) return null;
    setSyncing(true);
    setSyncError(null);
    try {
      const response = await requestJson<{ run: DriveManualSyncRun }>("/api/manuals/sync", {
        role,
        method: "POST",
        body: {},
      });
      const result = await fetchSnapshot();
      if (result) applyLoad(result);
      return response.run ?? null;
    } catch (syncFailure) {
      setSyncError(messageOf(syncFailure, "Drive sync failed."));
      return null;
    } finally {
      setSyncing(false);
    }
  }, [applyLoad, fetchSnapshot, role]);

  const updateManual = useCallback(
    async (id: string, patch: { manufacturer?: string | null; model?: string | null }) => {
      if (!role) return null;
      const response = await requestJson<{ manual: DriveManualFile }>(
        `/api/manuals/${encodeURIComponent(id)}`,
        { role, method: "PATCH", body: patch },
      );
      const manual = response.manual ?? null;
      if (manual) {
        setSnapshot((current) =>
          current
            ? { ...current, files: current.files.map((file) => (file.id === manual.id ? manual : file)) }
            : current,
        );
      }
      return manual;
    },
    [role],
  );

  const value = useMemo(
    () => ({ snapshot, loading, error, syncing, syncError, refresh, sync, updateManual }),
    [snapshot, loading, error, syncing, syncError, refresh, sync, updateManual],
  );

  return <DriveManualsContext.Provider value={value}>{children}</DriveManualsContext.Provider>;
}

export function useDriveManuals(): DriveManualsContextValue {
  const context = useContext(DriveManualsContext);
  if (!context) throw new Error("useDriveManuals must be used inside DriveManualsProvider");
  return context;
}
