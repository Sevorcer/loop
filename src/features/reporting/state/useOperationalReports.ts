"use client";

import { useEffect, useState } from "react";

import type { OperationalReports } from "../utils/operationalReports";

interface UseOperationalReportsResult {
  reports: OperationalReports | null;
  loading: boolean;
  error: string | null;
}

/** Fetches the four operational reports for the given "YYYY-MM" month. */
export function useOperationalReports(month: string): UseOperationalReportsResult {
  const [reports, setReports] = useState<OperationalReports | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchReports() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/reports?month=${encodeURIComponent(month)}`, {
          credentials: "same-origin",
        });
        if (!res.ok) {
          throw new Error(`Reports request failed (${res.status})`);
        }
        const body = (await res.json()) as { reports: OperationalReports };
        if (!cancelled) {
          setReports(body.reports);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load reports.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchReports();

    return () => {
      cancelled = true;
    };
  }, [month]);

  return { reports, loading, error };
}
