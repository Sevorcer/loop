"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Briefcase,
  CalendarClock,
  ExternalLink,
  MapPin,
  User,
  Wrench,
} from "lucide-react";
import Link from "next/link";

import { PermissionGuard, StatusBadge } from "@/components/atlas";
import { JobInstalledSystemsPanel } from "@/features/installed-systems/components/JobInstalledSystemsPanel";
import { useInstalledSystems } from "@/features/installed-systems/state/InstalledSystemsProvider";
import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";
import { ROUTE_BUILDERS } from "@/lib/routes";

import type { Job, JobStatus } from "../types/job";
import type { JobActivity } from "../types/jobActivity";
import { parseLatestQaChecklist, type RequiredQaChecklist } from "../utils/jobCompletionChecklist";
import { getJobStatusIntent, sortJobActivity } from "../utils/jobWorkspace";
import { AssignContractorPanel } from "./AssignContractorPanel";
import { JobCompletionChecklistCard } from "./JobCompletionChecklistCard";
import { JobFilesPanel } from "./JobFilesPanel";
import { JobNoteComposer } from "./JobNoteComposer";
import { JobStatusActions } from "./JobStatusActions";
import { JobTimeline } from "./JobTimeline";
import { readJobAppointmentHour, formatJobAppointmentHour } from "../utils/appointmentWindow";

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

interface JobDetailScreenProps {
  job: Job;
  activity: JobActivity[];
  onUpdateStatus: (status: JobStatus) => Promise<void>;
  onSaveNotes: (notes: string) => Promise<void>;
  onUpdateQaChecklist: (checklist: RequiredQaChecklist) => Promise<void>;
}

export function JobDetailScreen({
  job,
  activity,
  onUpdateStatus,
  onSaveNotes,
  onUpdateQaChecklist,
}: JobDetailScreenProps) {
  const { getInstalledSystemsForJob } = useInstalledSystems();
  const [fileCount, setFileCount] = useState(0);
  const [photoCount, setPhotoCount] = useState(0);
  const orderedActivity = useMemo(() => sortJobActivity(activity), [activity]);
  const appointmentHour = readJobAppointmentHour(job);
  const statusVariant = getStatusVariant(job.status);
  const priorityVariant = getPriorityVariant(job.priority);
  const statusIntent = getJobStatusIntent(job.status);
  const qaChecklist = useMemo(() => parseLatestQaChecklist(activity), [activity]);
  const installedSystemsEntered = getInstalledSystemsForJob(job.id).length > 0;
  const jobNotesCompleted = job.notes.trim().length > 0;

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

        <PermissionGuard table="jobs" action="update">
          <Link href={`/jobs/${job.id}/edit`}>
            <Button variant="secondary">Edit Job</Button>
          </Link>
        </PermissionGuard>
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
                {job.jobNumber}
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
                {job.title}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                {job.summary}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge variant={statusVariant}>
                {job.status}
              </StatusBadge>
              <StatusBadge variant={priorityVariant}>
                {job.priority} Priority
              </StatusBadge>
              <StatusBadge variant="neutral">{job.type}</StatusBadge>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Operational intent
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{statusIntent}</p>
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
              {job.summary}
            </p>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <h3 className="text-sm font-semibold text-white">Notes</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {job.notes || "No notes have been captured for this job yet."}
              </p>
            </div>
          </div>
        </SurfaceCard>

        <div className="space-y-6">
          <SurfaceCard>
            <div className="p-6">
              <h2 className="text-lg font-semibold text-white">Operational Context</h2>

              <div className="mt-5 space-y-4">
                <div className="flex items-start gap-3">
                  <User className="mt-0.5 h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Assigned To
                    </p>
                    <p className="mt-1 text-sm text-slate-200">
                      {job.assignedTo || "No technician assigned"}
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
                      {job.scheduledFor ? formatDate(job.scheduledFor) : "No schedule set"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CalendarClock className="mt-0.5 h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Appointment Hour
                    </p>
                    <p className="mt-1 text-sm text-slate-200">{formatJobAppointmentHour(appointmentHour)}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Location
                    </p>
                    <p className="mt-1 text-sm text-slate-200">
                      {job.location}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Briefcase className="mt-0.5 h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Customer
                    </p>
                    {job.customerId ? (
                      <Link
                        href={ROUTE_BUILDERS.CUSTOMER_DETAIL(job.customerId)}
                        className="mt-1 inline-flex items-center gap-1 text-sm text-blue-300 hover:text-blue-200 hover:underline"
                      >
                        {job.customerName}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : (
                      <p className="mt-1 text-sm text-slate-200">
                        {job.customerName || "No customer linked"}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-slate-500">
                      {job.customerId
                        ? "Linked customer record"
                        : "Reference only — no linked customer record"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Property
                    </p>
                    {job.propertyId ? (
                      <Link
                        href={ROUTE_BUILDERS.PROPERTY_DETAIL(job.propertyId)}
                        className="mt-1 inline-flex items-center gap-1 text-sm text-blue-300 hover:text-blue-200 hover:underline"
                      >
                        {job.propertyName}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : (
                      <p className="mt-1 text-sm text-slate-200">
                        {job.propertyName || "No property linked"}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-slate-500">
                      {job.propertyId
                        ? "Linked property record"
                        : "Reference only — no linked property record"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Wrench className="mt-0.5 h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Status Intent
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-200">
                      {statusIntent}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </SurfaceCard>

          <PermissionGuard table="jobs" action="update">
            <JobStatusActions
              status={job.status}
              onChangeStatus={onUpdateStatus}
            />
          </PermissionGuard>

          <JobFilesPanel
            jobId={job.id}
            onFilesChanged={(files) => {
              setFileCount(files.length);
              setPhotoCount(
                files.filter((file) => file.mimeType.toLowerCase().startsWith("image/")).length,
              );
            }}
          />

          <JobCompletionChecklistCard
            photosUploaded={photoCount > 0}
            installedSystemsEntered={installedSystemsEntered}
            jobNotesCompleted={jobNotesCompleted}
            initialChecklist={qaChecklist}
            onSaveChecklist={onUpdateQaChecklist}
          />

          <AssignContractorPanel jobId={job.id} />

          <JobInstalledSystemsPanel
              jobId={job.id}
              jobNumber={job.jobNumber}
              propertyId={job.propertyId ?? undefined}
              customerName={job.customerName}
              propertyName={job.propertyName}
            />

          <JobNoteComposer notes={job.notes} onSaveNotes={onSaveNotes} />

          <p className="text-center text-xs text-slate-500">
            Uploaded files: {fileCount}
          </p>
        </div>
      </div>

      <JobTimeline activity={orderedActivity} />
    </div>
  );
}
