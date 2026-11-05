"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  PRODUCTION_JOBS_PAGE_SIZE,
  type ProductionJobLine,
  type ProductionReport,
  type ProductionReportPage,
} from "../utils/productionReport";

interface UseProductionReportResult {
  /**
   * The report for the current range. `jobs` holds every row loaded so far
   * (page 1, plus any pages pulled in through `loadMore`); totals, teams, and
   * people are the full figures that arrive with page 1.
   */
  report: ProductionReport | null;
  loading: boolean;
  error: string | null;
  /** Total completed jobs in range, across every page. */
  jobsTotal: number;
  /** True when more job rows can be loaded. */
  hasMore: boolean;
  /** True while a `loadMore` request is in flight. */
  loadingMore: boolean;
  loadMore: () => void;
}

interface LoadedReport {
  from: string;
  to: string;
  summary: ProductionReportPage | null;
  jobs: ProductionJobLine[];
  nextPage: number;
  hasMore: boolean;
  jobsTotal: number;
  error: string | null;
}

async function fetchPage(
  from: string,
  to: string,
  page: number,
): Promise<ProductionReportPage> {
  const params = new URLSearchParams({
    from,
    to,
    page: String(page),
    pageSize: String(PRODUCTION_JOBS_PAGE_SIZE),
  });
  const response = await fetch(`/api/reports/production?${params.toString()}`, {
    credentials: "same-origin",
  });
  const body = (await response.json().catch(() => null)) as
    | { report?: ProductionReportPage; message?: string }
    | null;
  if (!response.ok) throw new Error(body?.message || "Reports request failed.");
  if (!body?.report) throw new Error("Reports request failed.");
  return body.report;
}

export function useProductionReport(from: string, to: string): UseProductionReportResult {
  const [loaded, setLoaded] = useState<LoadedReport | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  // The latest loaded snapshot, read by loadMore without re-running it on every
  // state change, and a guard so a page from a previous range is dropped.
  const loadedRef = useRef<LoadedReport | null>(null);
  const rangeRef = useRef({ from, to });

  useEffect(() => {
    loadedRef.current = loaded;
  }, [loaded]);

  useEffect(() => {
    rangeRef.current = { from, to };
    let cancelled = false;
    setLoadingMore(() => false);
    setLoaded(() => null);

    async function loadFirst() {
      try {
        const page = await fetchPage(from, to, 1);
        if (cancelled) return;
        setLoaded({
          from,
          to,
          summary: page,
          jobs: page.jobs,
          nextPage: 2,
          hasMore: page.hasMore,
          jobsTotal: page.jobsTotal,
          error: null,
        });
      } catch (err: unknown) {
        if (cancelled) return;
        setLoaded({
          from,
          to,
          summary: null,
          jobs: [],
          nextPage: 2,
          hasMore: false,
          jobsTotal: 0,
          error: err instanceof Error ? err.message : "Failed to load the production report.",
        });
      }
    }

    void loadFirst();
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  const loadMore = useCallback(() => {
    const current = loadedRef.current;
    const range = rangeRef.current;
    if (!current || !current.summary || !current.hasMore) return;
    if (current.from !== range.from || current.to !== range.to) return;

    const { from: rangeFrom, to: rangeTo, nextPage } = current;
    setLoadingMore(true);
    void (async () => {
      try {
        const page = await fetchPage(rangeFrom, rangeTo, nextPage);
        setLoaded((prev) => {
          // Drop a late page if the range changed or this page already landed.
          if (!prev || prev.from !== rangeFrom || prev.to !== rangeTo) return prev;
          if (prev.nextPage !== nextPage) return prev;
          return {
            ...prev,
            jobs: [...prev.jobs, ...page.jobs],
            nextPage: nextPage + 1,
            hasMore: page.hasMore,
            jobsTotal: page.jobsTotal,
          };
        });
      } catch {
        // Keep the rows already shown; the button stays available to retry.
      } finally {
        setLoadingMore(false);
      }
    })();
  }, []);

  const ready = loaded != null && loaded.from === from && loaded.to === to;
  const report =
    ready && loaded.summary ? { ...loaded.summary, jobs: loaded.jobs } : null;

  return {
    report,
    loading: !ready,
    error: ready ? loaded.error : null,
    jobsTotal: ready ? loaded.jobsTotal : 0,
    hasMore: ready ? loaded.hasMore : false,
    loadingMore: ready ? loadingMore : false,
    loadMore,
  };
}
