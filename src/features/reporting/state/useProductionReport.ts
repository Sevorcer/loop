"use client";

import { useEffect, useState } from "react";

import type { ProductionReport } from "../utils/productionReport";

interface UseProductionReportResult {
  report: ProductionReport | null;
  loading: boolean;
  error: string | null;
}

export function useProductionReport(from: string, to: string): UseProductionReportResult {
  const [report, setReport] = useState<ProductionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
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
        if (!cancelled) setReport(body.report);
      } catch (err: unknown) {
        if (!cancelled) {
          setReport(null);
          setError(err instanceof Error ? err.message : "Failed to load the production report.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  return { report, loading, error };
}
