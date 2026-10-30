"use client";

import { useEffect, useState } from "react";

import type { ProductionReport } from "../utils/productionReport";

interface UseProductionReportResult {
  report: ProductionReport | null;
  loading: boolean;
  error: string | null;
}

interface LoadedReport {
  from: string;
  to: string;
  report: ProductionReport | null;
  error: string | null;
}

export function useProductionReport(from: string, to: string): UseProductionReportResult {
  const [loaded, setLoaded] = useState<LoadedReport | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const params = new URLSearchParams({ from, to });
        const response = await fetch(`/api/reports/production?${params.toString()}`, {
          credentials: "same-origin",
        });
        const body = (await response.json().catch(() => null)) as
          | { report?: ProductionReport; message?: string }
          | null;
        if (!response.ok) {
          throw new Error(body?.message || "Reports request failed.");
        }
        if (!body?.report) throw new Error("Reports request failed.");
        if (!cancelled) setLoaded({ from, to, report: body.report, error: null });
      } catch (err: unknown) {
        if (!cancelled) {
          setLoaded({
            from,
            to,
            report: null,
            error: err instanceof Error ? err.message : "Failed to load the production report.",
          });
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  const ready = loaded != null && loaded.from === from && loaded.to === to;
  return {
    report: ready ? loaded.report : null,
    loading: !ready,
    error: ready ? loaded.error : null,
  };
}
