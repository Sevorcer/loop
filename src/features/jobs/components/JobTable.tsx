"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Funnel } from "lucide-react";

import { DataTable, ErrorState } from "@/components/atlas";
import { DataTableToolbar } from "@/components/atlas/data-table";
import { useAuth, useCurrentRole } from "@/features/auth";
import { isOpenStatus, normalizeJobStatus } from "@/lib/jobs/status";
import { todayLocalISODate } from "@/lib/dates";
import { Button } from "@/components/ui/button";

import { useJobs } from "../state/JobsProvider";
import type { JobPriority, JobStatus, JobType } from "../types/job";
import { jobColumns } from "./JobColumns";

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

const priorityOptions: Array<JobPriority | "All"> = [
  "All",
  "Low",
  "Medium",
  "High",
];

type SearchParamValue = string | string[] | undefined;

interface JobTableProps {
  initialSearchParams?: Record<string, SearchParamValue>;
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
  const { user } = useAuth();
  const { jobs, loading, hydrated, error, refreshJobs } = useJobs();

  const [searchValue, setSearchValue] = useState(
    () => readSearchParam(initialSearchParams, "q") ?? "",
  );
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
  const [priorityFilter, setPriorityFilter] = useState<JobPriority | "All">(() => {
    const value = readSearchParam(initialSearchParams, "priority");
    return value && priorityOptions.includes(value as JobPriority)
      ? (value as JobPriority)
      : "All";
  });
  const [openOnly, setOpenOnly] = useState(
    () => readSearchParam(initialSearchParams, "open") === "true",
  );
  const [unassignedOnly, setUnassignedOnly] = useState(
    () => readSearchParam(initialSearchParams, "unassigned") === "true",
  );
  const [lateOnly, setLateOnly] = useState(
    () => readSearchParam(initialSearchParams, "late") === "true",
  );
  const [problemOnly, setProblemOnly] = useState(
    () => readSearchParam(initialSearchParams, "problem") === "true",
  );
  const [todayOnly, setTodayOnly] = useState(
    () => readSearchParam(initialSearchParams, "when") === "today",
  );

  const filteredJobs = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    const isTechView = role === "tech";
    const todayIso = todayLocalISODate();
    const scopedTechnicianNames = new Set<string>();
    const fullName = user?.user_metadata?.full_name;
    if (typeof fullName === "string" && fullName.trim()) {
      scopedTechnicianNames.add(fullName.trim().toLowerCase());
    }
    if (typeof user?.email === "string" && user.email.trim()) {
      scopedTechnicianNames.add(user.email.trim().toLowerCase());
    }

    return jobs.filter((job) => {
      if (isTechView) {
        const scheduledDate = job.scheduledFor?.slice(0, 10) ?? null;
        const isTodaysJob = scheduledDate === todayIso || job.status === "In Progress";
        if (!isTodaysJob) {
          return false;
        }

        if (scopedTechnicianNames.size > 0) {
          const assigned = job.assignedTo.trim().toLowerCase();
          if (!scopedTechnicianNames.has(assigned)) {
            return false;
          }
        }
      }

      const matchesSearch =
        query.length === 0 ||
        job.jobNumber.toLowerCase().includes(query) ||
        job.title.toLowerCase().includes(query) ||
        job.customerName.toLowerCase().includes(query) ||
        job.propertyName.toLowerCase().includes(query) ||
        job.assignedTo.toLowerCase().includes(query);

      const normalizedStatus = normalizeJobStatus(job.status);
      const matchesStatus = statusFilter === "All" || normalizedStatus === statusFilter;
      const matchesType = typeFilter === "All" || job.type === typeFilter;
      const matchesPriority =
        priorityFilter === "All" || job.priority === priorityFilter;
      const openStatus = isOpenStatus(job.status);
      const isUnassigned = job.assignedTo.trim().length === 0;
      const isLate = openStatus && !!job.scheduledFor && job.scheduledFor.slice(0, 10) < todayIso;
      const isProblem = isLate || isUnassigned || normalizedStatus === "On Hold";

      const matchesOpenOnly = !openOnly || openStatus;
      const matchesUnassignedOnly = !unassignedOnly || isUnassigned;
      const matchesLateOnly = !lateOnly || isLate;
      const matchesProblemOnly = !problemOnly || isProblem;
      const matchesTodayOnly = !todayOnly || (job.scheduledFor?.slice(0, 10) ?? null) === todayIso;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesType &&
        matchesPriority &&
        matchesOpenOnly &&
        matchesUnassignedOnly &&
        matchesLateOnly &&
        matchesProblemOnly &&
        matchesTodayOnly
      );
    });
  }, [
    jobs,
    lateOnly,
    openOnly,
    priorityFilter,
    problemOnly,
    role,
    searchValue,
    statusFilter,
    todayOnly,
    typeFilter,
    unassignedOnly,
    user,
  ]);

  const hasActiveFilters =
    searchValue.length > 0 ||
    statusFilter !== "All" ||
    typeFilter !== "All" ||
    priorityFilter !== "All" ||
    openOnly ||
    unassignedOnly ||
    lateOnly ||
    problemOnly ||
    todayOnly;

  if (loading || !hydrated) {
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

  if (error) {
    return (
      <ErrorState
        title="Unable to load jobs"
        description={error}
        action={
          <Button variant="outline" onClick={() => void refreshJobs()}>
            Try again
          </Button>
        }
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.02]">
      <DataTableToolbar
      searchPlaceholder={
        role === "tech"
          ? "Search my jobs for today..."
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
                  Type: {option}
                </option>
              ))}
            </select>

            <select
              value={priorityFilter}
              onChange={(e) =>
                setPriorityFilter(e.target.value as JobPriority | "All")
              }
              className="min-h-[44px] w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-red-500/40 sm:w-auto"
            >
              {priorityOptions.map((option) => (
                <option key={option} value={option}>
                  Priority: {option}
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
                  setPriorityFilter("All");
                  setOpenOnly(false);
                  setUnassignedOnly(false);
                  setLateOnly(false);
                  setProblemOnly(false);
                  setTodayOnly(false);
                }}
                className="w-full text-slate-300 hover:bg-white/5 hover:text-white sm:w-auto"
              >
                Clear
              </Button>
            ) : null}
          </div>
        }
      />

      <DataTable
        columns={jobColumns}
        data={filteredJobs}
        onRowClick={(job) => router.push(`/jobs/${job.id}`)}
      />
    </div>
  );
}