"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useCurrentRole } from "@/features/auth";
import { requestJson } from "@/lib/api/client";

import type {
  JobMaterialLine,
  JobMaterialPatchInput,
  JobMaterialState,
  JobMaterialSummary,
} from "../types/jobMaterials";
import {
  canManageJobMaterials,
  canUpdateJobMaterialProgress,
  summarizeJobMaterials,
} from "../utils/jobMaterials";

export interface NewJobMaterial {
  name: string;
  quantity?: number;
  unit?: string;
  partNumber?: string | null;
  notes?: string;
}

interface JobMaterialsContextValue {
  jobId: string;
  lines: JobMaterialLine[];
  summary: JobMaterialSummary;
  loading: boolean;
  error: string | null;
  /** Line ids with a write in flight. */
  pendingIds: ReadonlySet<string>;
  canManage: boolean;
  canProgress: boolean;
  refresh: () => Promise<void>;
  /** Apply a fresh server copy of the lines (plan actions return the whole view). */
  replaceLines: (lines: JobMaterialLine[]) => void;
  addLine: (input: NewJobMaterial) => Promise<boolean>;
  setLineState: (lineId: string, state: JobMaterialState) => Promise<boolean>;
  setLineQuantity: (lineId: string, quantity: number) => Promise<boolean>;
  updateLine: (lineId: string, patch: JobMaterialPatchInput) => Promise<boolean>;
  removeLine: (lineId: string) => Promise<boolean>;
}

const JobMaterialsContext = createContext<JobMaterialsContextValue | null>(null);

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function JobMaterialsProvider({
  jobId,
  children,
  onSummaryChange,
}: {
  jobId: string;
  children: ReactNode;
  /** Reports counts after every load/write (Dispatch chip, tab badge). */
  onSummaryChange?: (summary: JobMaterialSummary) => void;
}) {
  const { role } = useCurrentRole();
  const canManage = canManageJobMaterials(role);
  const canProgress = canUpdateJobMaterialProgress(role);

  const [lines, setLines] = useState<JobMaterialLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());
  const linesRef = useRef<JobMaterialLine[]>([]);
  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);

  const base = `/api/jobs/${encodeURIComponent(jobId)}/materials`;

  const fetchLines = useCallback(async () => {
    if (!role) return null;
    try {
      const data = await requestJson<{ materials: JobMaterialLine[] }>(base, {
        role,
        cache: "no-store",
      });
      return { lines: data.materials ?? [], error: null as string | null };
    } catch (loadError) {
      return { lines: null, error: errorMessage(loadError, "Could not load materials.") };
    }
  }, [base, role]);

  const applyLoad = useCallback(
    (result: { lines: JobMaterialLine[] | null; error: string | null }) => {
      if (result.lines) setLines(result.lines);
      setError(result.error);
      setLoading(false);
    },
    [],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await fetchLines();
    if (result) applyLoad(result);
    else setLoading(false);
  }, [applyLoad, fetchLines]);

  // Initial load: setState only after the request settles.
  useEffect(() => {
    let cancelled = false;
    void fetchLines().then((result) => {
      if (!cancelled && result) applyLoad(result);
    });
    return () => {
      cancelled = true;
    };
  }, [applyLoad, fetchLines]);

  const replaceLines = useCallback((next: JobMaterialLine[]) => {
    setLines(next);
    setError(null);
    setLoading(false);
  }, []);

  const summary = useMemo(() => summarizeJobMaterials(lines), [lines]);
  const summaryCallback = useRef(onSummaryChange);
  useEffect(() => {
    summaryCallback.current = onSummaryChange;
  }, [onSummaryChange]);
  useEffect(() => {
    if (!loading) summaryCallback.current?.(summary);
  }, [summary, loading]);

  const markPending = useCallback((id: string, on: boolean) => {
    setPendingIds((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const addLine = useCallback(
    async (input: NewJobMaterial) => {
      if (!role || !canManage) return false;
      try {
        const data = await requestJson<{ material: JobMaterialLine }>(base, {
          role,
          method: "POST",
          body: input,
        });
        setLines((current) => [...current, data.material]);
        setError(null);
        return true;
      } catch (writeError) {
        setError(errorMessage(writeError, "Could not add the material."));
        return false;
      }
    },
    [base, canManage, role],
  );

  const updateLine = useCallback(
    async (lineId: string, patch: JobMaterialPatchInput) => {
      if (!role || !canProgress) return false;
      const before = linesRef.current.find((line) => line.id === lineId);
      if (!before) return false;
      // Optimistic: the crew taps a lot of these on a phone.
      setLines((current) =>
        current.map((line) => (line.id === lineId ? { ...line, ...patch } : line)),
      );
      markPending(lineId, true);
      try {
        const data = await requestJson<{ material: JobMaterialLine }>(
          `${base}/${encodeURIComponent(lineId)}`,
          { role, method: "PATCH", body: patch },
        );
        setLines((current) =>
          current.map((line) => (line.id === lineId ? data.material : line)),
        );
        setError(null);
        return true;
      } catch (writeError) {
        setLines((current) => current.map((line) => (line.id === lineId ? before : line)));
        setError(errorMessage(writeError, "Could not update the material."));
        return false;
      } finally {
        markPending(lineId, false);
      }
    },
    [base, canProgress, markPending, role],
  );

  const setLineState = useCallback(
    (lineId: string, state: JobMaterialState) => updateLine(lineId, { state }),
    [updateLine],
  );

  const setLineQuantity = useCallback(
    (lineId: string, quantity: number) => updateLine(lineId, { quantity }),
    [updateLine],
  );

  const removeLine = useCallback(
    async (lineId: string) => {
      if (!role || !canManage) return false;
      markPending(lineId, true);
      try {
        await requestJson<{ ok: true }>(`${base}/${encodeURIComponent(lineId)}`, {
          role,
          method: "DELETE",
        });
        setLines((current) => current.filter((line) => line.id !== lineId));
        setError(null);
        return true;
      } catch (writeError) {
        setError(errorMessage(writeError, "Could not remove the material."));
        return false;
      } finally {
        markPending(lineId, false);
      }
    },
    [base, canManage, markPending, role],
  );

  const value = useMemo<JobMaterialsContextValue>(
    () => ({
      jobId,
      lines,
      summary,
      loading,
      error,
      pendingIds,
      canManage,
      canProgress,
      refresh,
      replaceLines,
      addLine,
      setLineState,
      setLineQuantity,
      updateLine,
      removeLine,
    }),
    [
      jobId,
      lines,
      summary,
      loading,
      error,
      pendingIds,
      canManage,
      canProgress,
      refresh,
      replaceLines,
      addLine,
      setLineState,
      setLineQuantity,
      updateLine,
      removeLine,
    ],
  );

  return <JobMaterialsContext.Provider value={value}>{children}</JobMaterialsContext.Provider>;
}

export function useJobMaterials(): JobMaterialsContextValue {
  const context = useContext(JobMaterialsContext);
  if (!context) throw new Error("useJobMaterials must be used inside JobMaterialsProvider");
  return context;
}
