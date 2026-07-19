"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Briefcase, CalendarClock, ClipboardList, TriangleAlert } from "lucide-react";

import { EmptyState, PageHeader, SectionCard, StatusBadge } from "@/components/atlas";
import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";

import { useJobs } from "../context/JobsContext";
import type { Job, JobPriority, JobStatus, JobType } from "../types";

const allValue = "all";
const statuses: Array<JobStatus | typeof allValue> = [allValue, "Scheduled", "In Progress", "On Hold", "Completed"];
const priorities: Array<JobPriority | typeof allValue> = [allValue, "High", "Medium", "Low"];
const types: Array<JobType | typeof allValue> = [allValue, "Install", "Service", "Maintenance", "Inspection"];

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString();
}

function getStatusVariant(status: JobStatus) {
  if (status === "Completed") return "success" as const;
  if (status === "On Hold") return "warning" as const;
  if (status === "In Progress") return "neutral" as const;
  return "destructive" as const;
}

function getPriorityVariant(priority: JobPriority) {
  if (priority === "High") return "destructive" as const;
  if (priority === "Medium") return "warning" as const;
  return "neutral" as const;
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <SurfaceCard>
      <div className="space-y-1 p-5">
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-2xl font-semibold text-slate-950">{value}</p>
        <p className="text-sm text-slate-500">{helper}</p>
      </div>
    </SurfaceCard>
  );
}

function JobRow({ job }: { job: Job }) {
  return (
    <tr className="border-b border-slate-200 last:border-0">
      <td className="px-4 py-4 align-top">
        <div>
          <Link
            href={`/jobs/${job.id}`}
            className="font-medium text-slate-950 underline-offset-4 hover:underline"
          >
            {job.title}
          </Link>
          <p className="mt-1 text-xs text-slate-500">{job.customerName}</p>
        </div>
      </td>
      <td className="px-4 py-4 text-sm text-slate-600">{job.propertyName}</td>
      <td className="px-4 py-4 text-sm text-slate-600">{job.assignedTo}</td>
      <td className="px-4 py-4 text-sm text-slate-600">{formatDate(job.scheduledFor)}</td>
      <td className="px-4 py-4">
        <StatusBadge variant={getPriorityVariant(job.priority)}>{job.priority}</StatusBadge>
      </td>
      <td className="px-4 py-4">
        <StatusBadge variant={getStatusVariant(job.status)}>{job.status}</StatusBadge>
      </td>
      <td className="px-4 py-4 text-sm text-slate-600">{job.type}</td>
    </tr>
  );
}

export function JobsScreen() {
  const { jobs, isHydrated } = useJobs();
  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState<typeof allValue | JobStatus>(allValue);
  const [priorityFilter, setPriorityFilter] = useState<typeof allValue | JobPriority>(allValue);
  const [typeFilter, setTypeFilter] = useState<typeof allValue | JobType>(allValue);

  const filteredJobs = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();

    return jobs.filter((job) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        [job.title, job.customerName, job.propertyName, job.assignedTo, job.location]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);
      const matchesStatus = statusFilter === allValue || job.status === statusFilter;
      const matchesPriority =
        priorityFilter === allValue || job.priority === priorityFilter;
      const matchesType = typeFilter === allValue || job.type === typeFilter;

      return matchesSearch && matchesStatus && matchesPriority && matchesType;
    });
  }, [jobs, priorityFilter, searchValue, statusFilter, typeFilter]);

  const hasActiveFilters =
    searchValue.trim().length > 0 ||
    statusFilter !== allValue ||
    priorityFilter !== allValue ||
    typeFilter !== allValue;

  const todayKey = new Date().toLocaleDateString("en-CA");
  const todayCount = jobs.filter((job) => job.scheduledFor === todayKey).length;
  const openCount = jobs.filter((job) => job.status !== "Completed").length;
  const highPriorityCount = jobs.filter((job) => job.priority === "High").length;

  function clearFilters() {
    setSearchValue("");
    setStatusFilter(allValue);
    setPriorityFilter(allValue);
    setTypeFilter(allValue);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jobs"
        description="Track installs, service work, inspections, and maintenance jobs from intake through field execution."
        actions={
          <Link href="/jobs/new">
            <Button>
              <Briefcase className="h-4 w-4" />
              New job
            </Button>
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Open jobs"
          value={openCount.toString()}
          helper="Active work still in motion"
        />
        <MetricCard
          label="High priority"
          value={highPriorityCount.toString()}
          helper="Jobs that likely need office attention"
        />
        <MetricCard
          label="Scheduled today"
          value={todayCount.toString()}
          helper="Work planned for today’s board"
        />
      </div>

      <SectionCard
        title="Jobs board"
        description="Search, filter, and jump straight into the current execution queue."
      >
        <div className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[2fr_repeat(3,minmax(0,1fr))_auto]">
            <div className="relative">
              <ClipboardList className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Search jobs, customers, properties, or technicians..."
                className="h-11 w-full rounded-lg border border-slate-300 pl-10 pr-3 text-sm outline-none transition focus:border-slate-900"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as typeof allValue | JobStatus)}
              className="h-11 rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-slate-900"
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status === allValue ? "All statuses" : status}
                </option>
              ))}
            </select>
            <select
              value={priorityFilter}
              onChange={(event) =>
                setPriorityFilter(event.target.value as typeof allValue | JobPriority)
              }
              className="h-11 rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-slate-900"
            >
              {priorities.map((priority) => (
                <option key={priority} value={priority}>
                  {priority === allValue ? "All priorities" : priority}
                </option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as typeof allValue | JobType)}
              className="h-11 rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-slate-900"
            >
              {types.map((type) => (
                <option key={type} value={type}>
                  {type === allValue ? "All job types" : type}
                </option>
              ))}
            </select>
            <Button variant="outline" onClick={clearFilters} disabled={!hasActiveFilters}>
              Clear
            </Button>
          </div>

          {!isHydrated ? (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="h-12 animate-pulse rounded-lg bg-white" />
              <div className="h-12 animate-pulse rounded-lg bg-white" />
              <div className="h-12 animate-pulse rounded-lg bg-white" />
            </div>
          ) : filteredJobs.length === 0 ? (
            <EmptyState
              title="No jobs match the current view"
              description={
                hasActiveFilters
                  ? "Try clearing a filter or broadening your search to find the job you need."
                  : "Create the first job to start building the board."
              }
              action={
                hasActiveFilters ? (
                  <Button variant="outline" onClick={clearFilters}>
                    Clear filters
                  </Button>
                ) : (
                  <Link href="/jobs/new">
                    <Button>Create first job</Button>
                  </Link>
                )
              }
            />
          ) : (
            <>
              <div className="flex items-center justify-between text-sm text-slate-500">
                <p>
                  Showing {filteredJobs.length} {filteredJobs.length === 1 ? "job" : "jobs"}
                </p>
                {highPriorityCount > 0 ? (
                  <div className="inline-flex items-center gap-2">
                    <TriangleAlert className="h-4 w-4 text-red-500" />
                    <span>{highPriorityCount} high-priority jobs need visibility</span>
                  </div>
                ) : null}
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse bg-white">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Job</th>
                        <th className="px-4 py-3 font-semibold">Property</th>
                        <th className="px-4 py-3 font-semibold">Assigned</th>
                        <th className="px-4 py-3 font-semibold">Scheduled</th>
                        <th className="px-4 py-3 font-semibold">Priority</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 font-semibold">Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredJobs.map((job) => (
                        <JobRow key={job.id} job={job} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="Workflow guidance"
        description="Keep the field board credible by routing office updates back into the live job record."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <CalendarClock className="h-5 w-5 text-slate-600" />
            <h3 className="mt-3 font-semibold text-slate-950">Create into detail</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              New jobs open into their live detail page so dispatch can keep momentum after intake.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <Briefcase className="h-5 w-5 text-slate-600" />
            <h3 className="mt-3 font-semibold text-slate-950">Edit without dead ends</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Job edits flow back into the same record and board without breaking local persistence.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <ClipboardList className="h-5 w-5 text-slate-600" />
            <h3 className="mt-3 font-semibold text-slate-950">Timeline stays current</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Notes, status changes, and core record edits land in the activity stream immediately.
            </p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
