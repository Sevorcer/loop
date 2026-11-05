"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Funnel } from "lucide-react";

import { DataTable, ErrorState } from "@/components/atlas";
import { DataTableToolbar } from "@/components/atlas/data-table";
import { useCurrentRole } from "@/features/auth";
import { normalizeJobStatus } from "@/lib/jobs/status";
import { ROUTE_BUILDERS } from "@/lib/routes";
import { Button } from "@/components/ui/button";
import { requestJson } from "@/lib/api/client";

import type { Job, JobStatus, JobType } from "../types/job";
import { jobTypeFilterLabel } from "@/features/jobs/utils/callbackJob";
import { CALLBACK_LABELS, CALLBACK_TYPE } from "@/lib/callbacks";

import { jobColumns } from "./JobColumns";

const PAGE_SIZE = 50;

const statusOptions: Array<JobStatus | "All"> = [
  "All",
  "Scheduled",
  "In Progress",
  "On Hold",
  "Completed",
  "Cancelled",
];

const typeOptions: Array<JobType | "All"> = [
  "All",
  "Install",
  "Service",
  "Maintenance",
  "Inspection",
  "Estimate",
  "Callback",
];

type SearchParamValue = string | string[] | undefined;

interface JobTableProps {
  initialSearchParams?: Record<string, SearchParamValue>;
}

interface PaginatedResponse {
  jobs: Job[];
  total: number;
  page: number;
  pageSize: number;
}

function readSearchParam(
  params: Record<string, SearchParamValue>,
  key: string,
): string | null {
  const value = params[key];
  if (Array.isArray(value)) return value[0] ?? null;
  return typeof value === "string" ? value : null;
}

export function JobTable({ initialSearchParams = {} }: JobTableProps) {
  const router = useRouter();
  const { role } = useCurrentRole();

  // ── Filter state ────────────────────────────────────────────────────
  const [searchValue, setSearchValue] = useState(
    () => readSearchParam(initialSearchParams, "q") ?? "",
  );
  const [debouncedSearch, setDebouncedSearch] = useState(searchValue);
  const [statusFilter, setStatusFilter] = useState<JobStatus | "All">(() => {
    const normalized = normalizeJobStatus(
      readSearchParam(initialSearchParams, "status"),
    );
    return normalized ?? "All";
  });
  const [typeFilter, setTypeFilter] = useState<JobType | "All">(() => {
    const value = readSearchParam(initialSearchParams, "type");
    return value && typeOptions.includes(value as JobType) ? (value as JobType) : "All";
  });
  // completedDate is a pass-through URL param (e.g. "today") used by the
  // dashboard "Completed today" tile to scope the listing to today's completions.
  const [completedDateFilter] = useState(
    () => readSearchParam(initialSearchParams, "completedDate") ?? undefined,
  );

  // ── Pagination state ────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchIdRef = useRef(0);

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchValue);
      setCurrentPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchValue]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, typeFilter]);

  // ── Fetch paginated data ────────────────────────────────────────────
  const fetchJobs = useCallback(async () => {
    if (!role) return;

    const id = ++fetchIdRef.current;
    setLoading(() => true);

    try {
      setError(() => null);
      const params = new URLSearchParams();
      params.set("page", String(currentPage));
      params.set("pageSize", String(PAGE_SIZE));

      if (statusFilter !== "All") params.set("status", statusFilter);
      if (typeFilter !== "All") params.set("type", typeFilter);
      if (completedDateFilter) params.set("completedDate", completedDateFilter);
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      // Option C: board sorts by scheduled date (soonest first). Priority
      // filter/column removed; jobs.priority stays in the database.
      params.set("sort", "scheduled_for");
      params.set("order", "asc");

      const response = await requestJson<PaginatedResponse>(
        `/api/jobs?${params.toString()}`,
        { role, cache: "no-store" },
      );

      // Only apply if this is still the latest fetch
      if (id === fetchIdRef.current) {
        setJobs(() => response.jobs);
        setTotal(() => response.total);
      }
    } catch (loadError) {
      if (id === fetchIdRef.current) {
        setError(() => loadError instanceof Error ? loadError.message : "Failed to load jobs.");
      }
    } finally {
      if (id === fetchIdRef.current) {
        setLoading(() => false);
      }
    }
  }, [role, currentPage, statusFilter, typeFilter, completedDateFilter, debouncedSearch]);

  useEffect(() => {
    void fetchJobs();
  }, [fetchJobs]);

  // ── Derived values ──────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const hasActiveFilters =
    searchValue.length > 0 ||
    statusFilter !== "All" ||
    typeFilter !== "All" ||
    !!completedDateFilter;

  if (loading && jobs.length === 0) {
    return (
      <div className="rounded-lg border bg-card">
        <div className="space-y-3 p-4">
          <div className="h-10 animate-pulse rounded-md bg-muted" />
          <div className="h-10 animate-pulse rounded-md bg-muted" />
          <div className="h-10 animate-pulse rounded-md bg-muted" />
          <div className="h-10 animate-pulse rounded-md bg-muted" />
          <div className="h-10 animate-pulse rounded-md bg-muted" />
        </div>
      </div>
    );
  }

  if (error && jobs.length === 0) {
    return (
      <ErrorState
        title="Unable to load jobs"
        description={error}
        action={
          <Button variant="outline" onClick={() => void fetchJobs()}>
            Try again
          </Button>
        }
      />
    );
  }

  return (
    <div className="md:overflow-hidden md:rounded-[28px] md:border md:border-white/10 md:bg-white/[0.02]">
      <DataTableToolbar
      searchPlaceholder={
        role === "tech"
          ? "Search my jobs..."
          : "Search jobs, customers, properties, or technicians..."
      }
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        primaryAction={
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-300 lg:flex">
              <Funnel className="h-3.5 w-3.5 text-slate-400" />
              Filters
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as JobStatus | "All")}
              className="min-h-[44px] w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-red-500/40 sm:w-auto"
            >
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  Status: {option}
                </option>
              ))}
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as JobType | "All")}
              className="min-h-[44px] w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-blue-500/40 sm:w-auto"
            >
              {typeOptions.map((option) => (
                <option key={option} value={option}>
                  Type: {option === "All" ? option : jobTypeFilterLabel(option)}
                </option>
              ))}
            </select>

            {hasActiveFilters ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setSearchValue("");
                  setStatusFilter("All");
                  setTypeFilter("All");
                }}
                className="w-full text-slate-300 hover:bg-white/5 hover:text-white sm:w-auto"
              >
                Clear
              </Button>
            ) : null}
          </div>
        }
      />

      {typeFilter === CALLBACK_TYPE ? (
        <p className="px-4 pb-1 pt-3 text-xs text-slate-400 md:px-6">
          {CALLBACK_LABELS.all}:{" "}
          <span className="font-semibold text-slate-200">{total}</span>
          {" — includes completed and cancelled"}
        </p>
      ) : null}

      {/* #29: the list is a bounded scroll region (~10 rows tall)
          instead of stretching the page for all 50 rows of the page. */}
      <div className="max-h-[620px] overflow-y-auto">
      <DataTable
        columns={jobColumns}
        data={jobs}
        getRowHref={(job) => ROUTE_BUILDERS.JOB_DETAIL(job.id)}
        onRowClick={(job) => router.push(ROUTE_BUILDERS.JOB_DETAIL(job.id))}
        disableInternalPagination
      />
      </div>

      {/* Server-side pagination controls */}
      <div className="flex items-center justify-between border-t border-white/10 px-4 py-3 md:px-6">
        <p className="text-sm text-slate-400">
          {total === 0
            ? "No jobs found"
            : `Showing ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, total)} of ${total}`}
        </p>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="gap-1 border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.07] disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Previous</span>
          </Button>

          <span className="min-w-[4rem] text-center text-sm text-slate-300">
            {currentPage} / {totalPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="gap-1 border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.07] disabled:opacity-40"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
