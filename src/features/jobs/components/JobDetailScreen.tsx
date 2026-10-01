"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Briefcase,
  CalendarClock,
  ExternalLink,
  HardHat,
  MapPin,
  User,
  Wrench,
} from "lucide-react";
import Link from "next/link";

import { PermissionGuard, StatusBadge } from "@/components/atlas";
import { useContractors } from "@/features/contractors/state/ContractorsProvider";
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
import { JobMobileActionBar } from "./JobMobileActionBar";
import { JobNoteComposer } from "./JobNoteComposer";
import { JobStatusActions } from "./JobStatusActions";
import { JobTasksCard } from "./JobTasksCard";
import { JobTimeline } from "./JobTimeline";
import { formatJobAppointmentDisplay } from "../utils/schedulingTime";
import { formatDateOnly } from "@/lib/dates";

function formatDate(value: string | null | undefined) {
  if (!value) return "Unscheduled";
  return formatDateOnly(value);
}

function formatJobDateRange(startValue: string | null | undefined, endValue: string | null | undefined): string | null { if (!startValue || !endValue) { return null; } const start = new Date(startValue); const end = new Date(endValue); if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) { return null; } const monthDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }); const yearFmt = new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: "UTC" }); return monthDay.format(start) + " – " + monthDay.format(end) + ", " + yearFmt.format(end); } function getStatusVariant(status: JobStatus) {
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
  const { contractors } = useContractors();
  const [fileCount, setFileCount] = useState(0);
  const [photoCount, setPhotoCount] = useState(0);
  const orderedActivity = useMemo(() => sortJobActivity(activity), [activity]);
  // F20: prefer the real scheduled time over the legacy appointment-hour
  // field, which always falls back to 9 AM for jobs created by the new form.
  const appointmentDisplay = formatJobAppointmentDisplay(job); const assignedTechNames = job.assignees && job.assignees.length > 0 ? job.assignees.map((assignee) => assignee.name).join(", ") : job.assignedTo || "No technician assigned"; const scheduleRangeLabel = formatJobDateRange(job.scheduledStartAt ?? job.scheduledFor, job.scheduledEndAt);
  // F15: "Assigned To" (internal technician) and "Assigned Contractors"
  // (external subs) are stored separately and could silently disagree on this
  // screen. Render them side by side so both facts are always visible together.
  const assignedContractorNames = useMemo(
    () =>
      (job.contractorIds ?? [])
        .map((id) => contractors.find((c) => c.id === id)?.companyName)
        .filter((name): name is string => Boolean(name)),
    [job.contractorIds, contractors],
  );
  const statusVariant = getStatusVariant(job.status);
  const priorityVariant = getPriorityVariant(job.priority);
  const statusIntent = getJobStatusIntent(job.status);
  const qaChecklist = useMemo(() => parseLatestQaChecklist(activity), [activity]);
  const installedSystemsEntered =
    getInstalledSystemsForJob(job.id, job.propertyId ?? undefined).length > 0;
  const jobNotesCompleted = job.notes.trim().length > 0;

  return (
    // F14: bottom padding keeps page content clear of the sticky mobile
    // action bar (md+ only shows the bar on small screens).
    <div className="space-y-6 pb-28 md:pb-0">
      <div className="flex items-center justify-between gap-4">
        <Link href="/jobs">
          <Button
            variant="ghost"
            className="min-h-[44px] gap-2 text-slate-300 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Jobs
          </Button>
        </Link>

        <PermissionGuard table="jobs" action="update">
          <Link href={`/jobs/${job.id}/edit`}>
            <Button variant="secondary" className="min-h-[44px]">
              Edit Job
            </Button>
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
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">
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
        <SurfaceCard className="min-w-0 xl:col-span-2">
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

        <div className="min-w-0 space-y-6">
          <SurfaceCard>
            <div className="p-6">
              <h2 className="text-lg font-semibold text-white">Operational Context</h2>

              <div className="mt-5 space-y-4">
                <div className="flex items-start gap-3">
                  <User className="mt-0.5 h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Assigned Technician
                    </p>
                    <p className="mt-1 text-sm text-slate-200">
                      {assignedTechNames}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <HardHat className="mt-0.5 h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Assigned Contractors
                    </p>
                    <p className="mt-1 text-sm text-slate-200">
                      {assignedContractorNames.length > 0
                        ? assignedContractorNames.join(", ")
                        : "None assigned"}
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
                      {scheduleRangeLabel ?? (job.scheduledFor ? formatDate(job.scheduledFor) : job.scheduledStartAt ? formatDate(job.scheduledStartAt) : "Unscheduled")}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CalendarClock className="mt-0.5 h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Appointment Hour
                    </p>
                    <p className="mt-1 text-sm text-slate-200">{appointmentDisplay}</p>
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
                        className="mt-1 inline-flex min-h-[44px] items-center gap-1 text-sm text-blue-300 hover:text-blue-200 hover:underline"
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
                        className="mt-1 inline-flex min-h-[44px] items-center gap-1 text-sm text-blue-300 hover:text-blue-200 hover:underline"
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
                files.filter(
                  (file) =>
                    file.mimeType.toLowerCase().startsWith("image/") && file.uploaderRole === "tech",
                ).length,
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

          <JobTasksCard jobId={job.id} jobType={job.type} />

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

      {/* F14: sticky phone action bar (Start / Mark Complete / Directions). */}
      <JobMobileActionBar job={job} onUpdateStatus={onUpdateStatus} />
    </div>
  );
}
