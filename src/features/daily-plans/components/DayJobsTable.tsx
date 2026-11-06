"use client";

import Link from "next/link";
import { Plus, X } from "lucide-react";

import type { Job } from "@/features/jobs/types/job";
import type { CrewRecord } from "../data/fieldCrews";
import {
  crewLabelForJob,
  customerSiteLabel,
  formatJobDayTime,
  jobAssigneeNames,
  jobIsAssigned,
  sortJobsForDayTable,
} from "../utils/dayPlanHelpers";

export interface AssignablePerson {
  id: string;
  name: string;
}

interface DayJobsTableProps {
  jobs: Job[];
  crews: CrewRecord[];
  people: AssignablePerson[];
  canEdit: boolean;
  onAssignPeople: (jobId: string, assigneeIds: string[]) => void;
  emptyMessage?: string;
  /** Compact print-friendly mode: no interactive controls. */
  printMode?: boolean;
}

function statusClasses(status: Job["status"]): string {
  switch (status) {
    case "In Progress":
      return "border-blue-500/25 bg-blue-500/10 text-blue-200";
    case "On Hold":
      return "border-yellow-500/25 bg-yellow-500/10 text-yellow-200";
    case "Completed":
      return "border-green-500/25 bg-green-500/10 text-green-200";
    case "Cancelled":
      return "border-slate-500/25 bg-slate-500/10 text-slate-300";
    default:
      return "border-white/10 bg-white/[0.04] text-slate-200";
  }
}

function TechChips({
  job,
  people,
  canEdit,
  onAssignPeople,
}: {
  job: Job;
  people: AssignablePerson[];
  canEdit: boolean;
  onAssignPeople: (jobId: string, assigneeIds: string[]) => void;
}) {
  const assignees = job.assignees ?? [];
  const names = jobAssigneeNames(job);
  const assignedIds = new Set(assignees.map((a) => a.id).filter(Boolean));

  const available = people.filter((person) => !assignedIds.has(person.id));

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {assignees.length > 0
        ? assignees.map((person) => (
            <span
              key={person.id || person.name}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[11px] text-slate-100"
            >
              {person.name}
              {canEdit && person.id ? (
                <button
                  type="button"
                  aria-label={`Remove ${person.name}`}
                  className="rounded-full p-0.5 text-slate-400 hover:bg-white/10 hover:text-white"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onAssignPeople(
                      job.id,
                      assignees.filter((a) => a.id !== person.id).map((a) => a.id),
                    );
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </span>
          ))
        : names.map((name) => (
            <span
              key={name}
              className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[11px] text-slate-100"
            >
              {name}
            </span>
          ))}

      {!jobIsAssigned(job) ? (
        <span className="text-[11px] text-yellow-300">Unassigned</span>
      ) : null}

      {canEdit && available.length > 0 ? (
        <label className="inline-flex items-center">
          <span className="sr-only">Add technician</span>
          <select
            className="h-7 max-w-[9rem] rounded-lg border border-white/10 bg-white/[0.04] px-1.5 text-[11px] text-slate-200 outline-none"
            defaultValue=""
            onChange={(event) => {
              const nextId = event.target.value;
              event.target.value = "";
              if (!nextId) return;
              const nextIds = [
                ...assignees.map((a) => a.id).filter(Boolean),
                nextId,
              ];
              onAssignPeople(job.id, Array.from(new Set(nextIds)));
            }}
          >
            <option value="">Add…</option>
            {available.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>
      ) : canEdit ? (
        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
          <Plus className="h-3 w-3" />
          No more people
        </span>
      ) : null}
    </div>
  );
}

function MobileCard({
  job,
  crews,
  people,
  canEdit,
  onAssignPeople,
  printMode,
}: {
  job: Job;
  crews: CrewRecord[];
  people: AssignablePerson[];
  canEdit: boolean;
  onAssignPeople: (jobId: string, assigneeIds: string[]) => void;
  printMode?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">
            {formatJobDayTime(job)} · {job.jobNumber}
          </p>
          <Link
            href={`/jobs/${job.id}`}
            className="mt-0.5 block truncate text-sm font-semibold text-white hover:underline"
          >
            {customerSiteLabel(job)}
          </Link>
          <p className="mt-0.5 text-xs text-slate-400">
            {job.type} · {crewLabelForJob(job, crews)}
          </p>
        </div>
        <span
          className={[
            "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium",
            statusClasses(job.status),
          ].join(" ")}
        >
          {job.status}
        </span>
      </div>
      {!printMode ? (
        <div className="mt-3">
          <TechChips
            job={job}
            people={people}
            canEdit={canEdit}
            onAssignPeople={onAssignPeople}
          />
        </div>
      ) : (
        <p className="mt-2 text-xs text-slate-300">
          {jobAssigneeNames(job).join(", ") || "Unassigned"}
        </p>
      )}
    </div>
  );
}

export function DayJobsTable({
  jobs,
  crews,
  people,
  canEdit,
  onAssignPeople,
  emptyMessage = "Nothing on the calendar for this day — pull from Unscheduled or open Dispatch.",
  printMode = false,
}: DayJobsTableProps) {
  const sorted = sortJobsForDayTable(jobs);

  if (sorted.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 px-6 py-10 text-center">
        <p className="text-sm text-slate-500">{emptyMessage}</p>
        {!printMode ? (
          <Link
            href="/dispatch"
            className="mt-3 inline-flex rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10"
          >
            Open Dispatch
          </Link>
        ) : null}
      </div>
    );
  }

  return (
    <>
      {/* Desktop / print table */}
      <div className={printMode ? "block" : "hidden md:block"}>
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-white/[0.04] text-[11px] uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th className="px-3 py-2.5 font-semibold">Time</th>
                <th className="px-3 py-2.5 font-semibold">Job #</th>
                <th className="px-3 py-2.5 font-semibold">Customer / site</th>
                {printMode ? <th className="px-3 py-2.5 font-semibold">Address</th> : null}
                <th className="px-3 py-2.5 font-semibold">Type</th>
                <th className="px-3 py-2.5 font-semibold">Status</th>
                <th className="px-3 py-2.5 font-semibold">Techs</th>
                <th className="px-3 py-2.5 font-semibold">Truck / crew</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((job) => (
                <tr
                  key={job.id}
                  className="border-t border-white/10 align-top odd:bg-white/[0.015] hover:bg-white/[0.04]"
                >
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-slate-200">
                    {formatJobDayTime(job)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <Link
                      href={`/jobs/${job.id}`}
                      className="font-medium text-blue-200 hover:underline"
                    >
                      {job.jobNumber}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-slate-100">
                    <Link href={`/jobs/${job.id}`} className="hover:underline">
                      {customerSiteLabel(job)}
                    </Link>
                  </td>
                  {printMode ? (
                    <td className="px-3 py-2.5 text-slate-300">
                      {job.location.trim() || job.propertyName.trim() || "—"}
                    </td>
                  ) : null}
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-300">{job.type}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <span
                      className={[
                        "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium",
                        statusClasses(job.status),
                      ].join(" ")}
                    >
                      {job.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    {printMode ? (
                      <span className="text-slate-200">
                        {jobAssigneeNames(job).join(", ") || "Unassigned"}
                      </span>
                    ) : (
                      <TechChips
                        job={job}
                        people={people}
                        canEdit={canEdit}
                        onAssignPeople={onAssignPeople}
                      />
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-300">
                    {crewLabelForJob(job, crews)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      {!printMode ? (
        <div className="space-y-3 md:hidden">
          {sorted.map((job) => (
            <MobileCard
              key={job.id}
              job={job}
              crews={crews}
              people={people}
              canEdit={canEdit}
              onAssignPeople={onAssignPeople}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}
