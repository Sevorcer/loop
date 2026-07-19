"use client";

import { useMemo } from "react";
import {
  ArrowLeft,
  Briefcase,
  CalendarClock,
  MapPin,
  User,
  Wrench,
} from "lucide-react";
import Link from "next/link";

import { StatusBadge } from "@/components/atlas";
import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";

import { useJobs } from "../state/JobsProvider";
import type { Job, JobStatus } from "../types/job";
import { JobNoteComposer } from "./JobNoteComposer";
import { JobStatusActions } from "./JobStatusActions";
import { JobTimeline } from "./JobTimeline";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function getStatusVariant(status: JobStatus) {
  if (status === "Completed") return "success" as const;
  if (status === "Scheduled") return "info" as const;
  if (status === "In Progress") return "warning" as const;
  if (status === "On Hold") return "neutral" as const;
  return "danger" as const;
}

function getPriorityVariant(priority: Job["priority"]) {
  if (priority === "High") return "danger" as const;
  if (priority === "Medium") return "warning" as const;
  return "neutral" as const;
}

export function JobDetailScreen({ job }: { job: Job }) {
  const { getJobById, getActivityByJobId, updateJobStatus, addJobNote } = useJobs();

  const currentJob = getJobById(job.id) ?? job;
  const activity = getActivityByJobId(job.id);

  const badges = useMemo(
    () => ({
      statusVariant: getStatusVariant(currentJob.status),
      priorityVariant: getPriorityVariant(currentJob.priority),
    }),
    [currentJob.priority, currentJob.status]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Link href="/jobs">
          <Button
            variant="ghost"
            className="gap-2 text-slate-300 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Jobs
          </Button>
        </Link>
      </div>

      <SurfaceCard className="overflow-hidden">
        <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-red-300">
              <Wrench className="h-3.5 w-3.5" />
              Job Detail
            </div>

            <div>
              <p className="text-sm font-medium text-slate-400">
                {currentJob.jobNumber}
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
                {currentJob.title}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                {currentJob.summary}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge variant={badges.statusVariant}>
                {currentJob.status}
              </StatusBadge>
              <StatusBadge variant={badges.priorityVariant}>
                {currentJob.priority} Priority
              </StatusBadge>
              <StatusBadge variant="neutral">{currentJob.type}</StatusBadge>
            </div>
          </div>

          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-red-500/15 to-blue-500/10 ring-1 ring-white/10">
            <Briefcase className="h-7 w-7 text-red-300" />
          </div>
        </div>
      </SurfaceCard>

      <div className="grid gap-6 xl:grid-cols-3">
        <SurfaceCard className="xl:col-span-2">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-white">Work Summary</h2>
            <p className="mt-3 text-sm leading-7 text-slate-400">
              {currentJob.summary}
            </p>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <h3 className="text-sm font-semibold text-white">Notes</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {currentJob.notes}
              </p>
            </div>
          </div>
        </SurfaceCard>

        <div className="space-y-6">
          <SurfaceCard>
            <div className="p-6">
              <h2 className="text-lg font-semibold text-white">Job Info</h2>

              <div className="mt-5 space-y-4">
                <div className="flex items-start gap-3">
                  <User className="mt-0.5 h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Assigned To
                    </p>
                    <p className="mt-1 text-sm text-slate-200">
                      {currentJob.assignedTo}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CalendarClock className="mt-0.5 h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Scheduled For
                    </p>
                    <p className="mt-1 text-sm text-slate-200">
                      {formatDate(currentJob.scheduledFor)}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Location
                    </p>
                    <p className="mt-1 text-sm text-slate-200">
                      {currentJob.location}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Briefcase className="mt-0.5 h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Customer
                    </p>
                    <p className="mt-1 text-sm text-slate-200">
                      {currentJob.customerName}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {currentJob.propertyName}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </SurfaceCard>

          <JobStatusActions
            status={currentJob.status}
            onChangeStatus={(nextStatus) =>
              updateJobStatus(currentJob.id, nextStatus)
            }
          />

          <JobNoteComposer onAddNote={(note) => addJobNote(currentJob.id, note)} />
        </div>
      </div>

      <JobTimeline activity={activity} />
    </div>
  );
}