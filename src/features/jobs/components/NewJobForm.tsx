"use client";

import { useState } from "react";
import { CheckCircle2, ClipboardPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";

import { useJobs } from "../state/JobsProvider";
import type { JobPriority, JobType } from "../types/job";

const jobTypes: JobType[] = ["Install", "Service", "Maintenance", "Inspection"];
const priorities: JobPriority[] = ["Low", "Medium", "High"];

export function NewJobForm() {
  const router = useRouter();
  const { createJob } = useJobs();

  const [submittedJobId, setSubmittedJobId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    customerName: "",
    propertyName: "",
    assignedTo: "",
    scheduledFor: "",
    type: "Service" as JobType,
    priority: "Medium" as JobPriority,
    location: "",
    summary: "",
    notes: "",
  });

  function updateField<K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K]
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const job = createJob(form);
    setSubmittedJobId(job.id);
  }

  if (submittedJobId) {
    return (
      <SurfaceCard className="mx-auto max-w-3xl">
        <div className="space-y-4 p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-500/15 to-blue-500/10 ring-1 ring-white/10">
            <CheckCircle2 className="h-7 w-7 text-emerald-300" />
          </div>

          <div>
            <h1 className="text-2xl font-semibold text-white">Job created</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Your new job has been added to the Jobs board and is ready for
              execution tracking.
            </p>
          </div>

          <div className="flex justify-center gap-3">
            <Link href="/jobs">
              <Button variant="secondary">Back to Jobs</Button>
            </Link>

            <Button onClick={() => router.push(`/jobs/${submittedJobId}`)}>
              Open Job
            </Button>
          </div>
        </div>
      </SurfaceCard>
    );
  }

  return (
    <div className="space-y-6">
      <SurfaceCard className="overflow-hidden">
        <div className="flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-red-300">
              <ClipboardPlus className="h-3.5 w-3.5" />
              New Workflow Entry
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                Create Job
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Capture a new install, service, maintenance, or inspection job
                and route it into the execution workflow.
              </p>
            </div>
          </div>

          <Link href="/jobs">
            <Button
              variant="ghost"
              className="text-slate-300 hover:text-white"
            >
              Back to Jobs
            </Button>
          </Link>
        </div>
      </SurfaceCard>

      <form onSubmit={handleSubmit}>
        <SurfaceCard>
          <div className="grid gap-6 p-6 lg:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">
                Job Title
              </label>
              <input
                value={form.title}
                onChange={(e) => updateField("title", e.target.value)}
                placeholder="Emergency condenser repair"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-red-500/40"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">
                Customer Name
              </label>
              <input
                value={form.customerName}
                onChange={(e) => updateField("customerName", e.target.value)}
                placeholder="Northside Retail Group"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-red-500/40"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">
                Property Name
              </label>
              <input
                value={form.propertyName}
                onChange={(e) => updateField("propertyName", e.target.value)}
                placeholder="Northside Plaza"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-red-500/40"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">
                Assigned Technician
              </label>
              <input
                value={form.assignedTo}
                onChange={(e) => updateField("assignedTo", e.target.value)}
                placeholder="Marcus Rivera"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-red-500/40"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">
                Scheduled Date
              </label>
              <input
                type="date"
                value={form.scheduledFor}
                onChange={(e) => updateField("scheduledFor", e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-red-500/40"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">
                Location
              </label>
              <input
                value={form.location}
                onChange={(e) => updateField("location", e.target.value)}
                placeholder="1450 Northside Blvd, Suite 100"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-red-500/40"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">
                Job Type
              </label>
              <select
                value={form.type}
                onChange={(e) => updateField("type", e.target.value as JobType)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-blue-500/40"
              >
                {jobTypes.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">
                Priority
              </label>
              <select
                value={form.priority}
                onChange={(e) =>
                  updateField("priority", e.target.value as JobPriority)
                }
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-red-500/40"
              >
                {priorities.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2 lg:col-span-2">
              <label className="text-sm font-medium text-slate-200">
                Work Summary
              </label>
              <textarea
                value={form.summary}
                onChange={(e) => updateField("summary", e.target.value)}
                rows={4}
                placeholder="Describe the requested install, service issue, maintenance scope, or inspection objective."
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-red-500/40"
                required
              />
            </div>

            <div className="space-y-2 lg:col-span-2">
              <label className="text-sm font-medium text-slate-200">
                Notes
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                rows={4}
                placeholder="Add scheduling notes, access instructions, customer expectations, or internal prep details."
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-red-500/40"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-white/10 px-6 py-4">
            <Link href="/jobs">
              <Button
                type="button"
                variant="ghost"
                className="text-slate-300 hover:text-white"
              >
                Cancel
              </Button>
            </Link>

            <Button type="submit" className="gap-2">
              <ClipboardPlus className="h-4 w-4" />
              Create Job
            </Button>
          </div>
        </SurfaceCard>
      </form>
    </div>
  );
}