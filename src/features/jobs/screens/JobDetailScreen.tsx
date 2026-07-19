"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, ClipboardList, MapPin, Pencil, UserRound, Wrench } from "lucide-react";

import { EmptyState, StatusBadge } from "@/components/atlas";
import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";

import { useJobs } from "../context/JobsContext";
import type { JobPriority, JobStatus } from "../types";
import { formatJobDate } from "../utils";

const statusOptions: JobStatus[] = ["Scheduled", "In Progress", "On Hold", "Completed"];

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString();
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

export function JobDetailScreen() {
  const params = useParams<{ id: string }>();
  const { getJobById, isHydrated, addJobNote, updateJobStatus } = useJobs();
  const [note, setNote] = useState("");

  const job = useMemo(() => getJobById(params.id), [getJobById, params.id]);

  if (!isHydrated) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-52 animate-pulse rounded-2xl bg-white" />
      </div>
    );
  }

  if (!job) {
    return (
      <EmptyState
        title="Job not found"
        description="This job may have been removed from local storage or the link may be out of date."
        action={
          <Link href="/jobs">
            <Button>Back to jobs</Button>
          </Link>
        }
      />
    );
  }

  function handleAddNote() {
    if (!job) {
      return;
    }

    addJobNote(job.id, note);
    setNote("");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <Link
            href="/jobs"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to jobs
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                {job.title}
              </h1>
              <StatusBadge variant={getPriorityVariant(job.priority)}>
                {job.priority}
              </StatusBadge>
              <StatusBadge variant={getStatusVariant(job.status)}>
                {job.status}
              </StatusBadge>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              {job.summary}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link href={`/jobs/${job.id}/edit`}>
            <Button variant="outline">
              <Pencil className="h-4 w-4" />
              Edit job
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="space-y-6">
          <SurfaceCard>
            <div className="grid gap-4 p-6 md:grid-cols-2">
              <div>
                <p className="text-sm text-slate-500">Customer</p>
                <p className="mt-1 font-medium text-slate-950">{job.customerName}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Property</p>
                <p className="mt-1 font-medium text-slate-950">{job.propertyName}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Assigned technician</p>
                <p className="mt-1 inline-flex items-center gap-2 font-medium text-slate-950">
                  <UserRound className="h-4 w-4 text-slate-500" />
                  {job.assignedTo}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Scheduled for</p>
                <p className="mt-1 font-medium text-slate-950">{formatJobDate(job.scheduledFor)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Job type</p>
                <p className="mt-1 inline-flex items-center gap-2 font-medium text-slate-950">
                  <Wrench className="h-4 w-4 text-slate-500" />
                  {job.type}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Location</p>
                <p className="mt-1 inline-flex items-center gap-2 font-medium text-slate-950">
                  <MapPin className="h-4 w-4 text-slate-500" />
                  {job.location}
                </p>
              </div>
              <div className="md:col-span-2">
                <p className="text-sm text-slate-500">Internal notes</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {job.notes || "No internal notes captured yet."}
                </p>
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard>
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-950">Activity timeline</h2>
              <p className="mt-1 text-sm text-slate-500">
                Create, edit, note, and status changes all stay attached to the job record.
              </p>
            </div>
            <div className="space-y-4 p-6">
              {job.activities.length === 0 ? (
                <p className="text-sm text-slate-500">No activity yet.</p>
              ) : (
                job.activities.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <h3 className="font-medium text-slate-950">{item.title}</h3>
                      <p className="text-xs text-slate-500">
                        {formatTimestamp(item.createdAt)}
                      </p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {item.description}
                    </p>
                  </div>
                ))
              )}
            </div>
          </SurfaceCard>
        </div>

        <div className="space-y-6">
          <SurfaceCard>
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-950">Quick status actions</h2>
              <p className="mt-1 text-sm text-slate-500">
                Keep the board current as office or field updates come in.
              </p>
            </div>
            <div className="grid gap-3 p-6">
              {statusOptions.map((status) => (
                <Button
                  key={status}
                  variant={status === job.status ? "primary" : "outline"}
                  className="justify-start"
                  onClick={() => updateJobStatus(job.id, status)}
                  disabled={status === job.status}
                >
                  {status}
                </Button>
              ))}
            </div>
          </SurfaceCard>

          <SurfaceCard>
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-950">Add note</h2>
              <p className="mt-1 text-sm text-slate-500">
                Capture office follow-up, customer context, or field coordination updates.
              </p>
            </div>
            <div className="space-y-4 p-6">
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={4}
                placeholder="Customer approved after-hours access for tomorrow morning."
                className="w-full rounded-lg border border-slate-300 px-3 py-3 text-sm outline-none transition focus:border-slate-900"
              />
              <Button onClick={handleAddNote} disabled={note.trim().length === 0}>
                <ClipboardList className="h-4 w-4" />
                Add note
              </Button>
            </div>
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}
