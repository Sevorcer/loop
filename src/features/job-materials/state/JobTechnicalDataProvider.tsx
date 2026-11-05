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

import type { JobTechnicalData } from "../types/jobMaterials";

interface JobTechnicalDataContextValue {
  data: JobTechnicalData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const JobTechnicalDataContext = createContext<JobTechnicalDataContextValue | null>(null);

/**
 * Loads /api/jobs/[id]/technical-data once per job. Read-only: the specs come
 * from the equipment records and Company Brain, not from this panel.
 */
export function JobTechnicalDataProvider({
  jobId,
  children,
}: {
  jobId: string;
  children: ReactNode;
}) {
  const { role } = useCurrentRole();
  const [data, setData] = useState<JobTechnicalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!role) return null;
    try {
      const response = await requestJson<{ technicalData: JobTechnicalData }>(
        `/api/jobs/${encodeURIComponent(jobId)}/technical-data`,
        { role, cache: "no-store" },
      );
      return { data: response.technicalData ?? null, error: null as string | null };
    } catch (loadError) {
      return {
        data: null,
        error:
          loadError instanceof Error && loadError.message
            ? loadError.message
            : "Could not load technical data.",
      };
    }
  }, [jobId, role]);

  const applyLoad = useCallback(
    (result: { data: JobTechnicalData | null; error: string | null }) => {
      setData(result.data);
      setError(result.error);
      setLoading(false);
    },
    [],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await fetchData();
    if (result) applyLoad(result);
    else setLoading(false);
  }, [applyLoad, fetchData]);

  // Initial load: setState only after the request settles.
  useEffect(() => {
    let cancelled = false;
    void fetchData().then((result) => {
      if (!cancelled && result) applyLoad(result);
    });
    return () => {
      cancelled = true;
    };
  }, [applyLoad, fetchData]);

  const value = useMemo(
    () => ({ data, loading, error, refresh }),
    [data, loading, error, refresh],
  );

  return (
    <JobTechnicalDataContext.Provider value={value}>{children}</JobTechnicalDataContext.Provider>
  );
}

export function useJobTechnicalData(): JobTechnicalDataContextValue {
  const context = useContext(JobTechnicalDataContext);
  if (!context) {
    throw new Error("useJobTechnicalData must be used inside JobTechnicalDataProvider");
  }
  return context;
}
