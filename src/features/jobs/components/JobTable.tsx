"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Funnel } from "lucide-react";

import { DataTable } from "@/components/atlas";
import { DataTableToolbar } from "@/components/atlas/data-table";
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
];

const priorityOptions: Array<JobPriority | "All"> = [
  "All",
  "Low",
  "Medium",
  "High",
];

export function JobTable() {
  const router = useRouter();
  const { jobs } = useJobs();

  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState<JobStatus | "All">("All");
  const [typeFilter, setTypeFilter] = useState<JobType | "All">("All");
  const [priorityFilter, setPriorityFilter] = useState<JobPriority | "All">("All");

  const filteredJobs = useMemo(() => {
    const query = searchValue.trim().toLowerCase();

    return jobs.filter((job) => {
      const matchesSearch =
        query.length === 0 ||
        job.jobNumber.toLowerCase().includes(query) ||
        job.title.toLowerCase().includes(query) ||
        job.customerName.toLowerCase().includes(query) ||
        job.propertyName.toLowerCase().includes(query) ||
        job.assignedTo.toLowerCase().includes(query);

      const matchesStatus = statusFilter === "All" || job.status === statusFilter;
      const matchesType = typeFilter === "All" || job.type === typeFilter;
      const matchesPriority =
        priorityFilter === "All" || job.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesType && matchesPriority;
    });
  }, [jobs, priorityFilter, searchValue, statusFilter, typeFilter]);

  const hasActiveFilters =
    searchValue.length > 0 ||
    statusFilter !== "All" ||
    typeFilter !== "All" ||
    priorityFilter !== "All";

  return (
    <div className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.02]">
      <DataTableToolbar
        searchPlaceholder="Search jobs, customers, properties, or technicians..."
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
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-red-500/40 sm:w-auto"
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
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-blue-500/40 sm:w-auto"
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
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-red-500/40 sm:w-auto"
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