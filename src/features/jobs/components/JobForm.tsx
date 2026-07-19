"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";

import type { Job, JobInput, JobPriority, JobType } from "../types";

const jobTypes: JobType[] = ["Install", "Service", "Maintenance", "Inspection"];
const priorities: JobPriority[] = ["Low", "Medium", "High"];

const emptyForm: JobInput = {
  title: "",
  customerName: "",
  propertyName: "",
  assignedTo: "",
  scheduledFor: "",
  type: "Service",
  priority: "Medium",
  location: "",
  summary: "",
  notes: "",
};

type JobFormProps = {
  mode: "create" | "edit";
  job?: Job;
  onSubmit: (input: JobInput) => void;
  onCancelHref: string;
  submitLabel: string;
};

export function JobForm({
  mode,
  job,
  onSubmit,
  onCancelHref,
  submitLabel,
}: JobFormProps) {
  const initialValues = useMemo<JobInput>(() => {
    if (!job) {
      return emptyForm;
    }

    return {
      title: job.title,
      customerName: job.customerName,
      propertyName: job.propertyName,
      assignedTo: job.assignedTo,
      scheduledFor: job.scheduledFor,
      type: job.type,
      priority: job.priority,
      location: job.location,
      summary: job.summary,
      notes: job.notes,
    };
  }, [job]);

  const [form, setForm] = useState<JobInput>(initialValues);

  function updateField<K extends keyof JobInput>(key: K, value: JobInput[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(form);
  }

  const heading = mode === "create" ? "Create Job" : "Edit Job";
  const description =
    mode === "create"
      ? "Capture a new field job and route it straight into the active board."
      : "Update the job details and keep the execution plan aligned for the field team.";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          {heading}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          {description}
        </p>
      </div>

      <div className="grid gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Job title</label>
          <input
            value={form.title}
            onChange={(event) => updateField("title", event.target.value)}
            placeholder="Emergency condenser repair"
            className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-slate-900"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Customer name</label>
          <input
            value={form.customerName}
            onChange={(event) => updateField("customerName", event.target.value)}
            placeholder="Northside Retail Group"
            className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-slate-900"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Property name</label>
          <input
            value={form.propertyName}
            onChange={(event) => updateField("propertyName", event.target.value)}
            placeholder="Northside Plaza"
            className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-slate-900"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Assigned to</label>
          <input
            value={form.assignedTo}
            onChange={(event) => updateField("assignedTo", event.target.value)}
            placeholder="Marcus Rivera"
            className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-slate-900"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Scheduled for</label>
          <input
            type="date"
            value={form.scheduledFor}
            onChange={(event) => updateField("scheduledFor", event.target.value)}
            className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-slate-900"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Location</label>
          <input
            value={form.location}
            onChange={(event) => updateField("location", event.target.value)}
            placeholder="1450 Northside Blvd, Suite 100"
            className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-slate-900"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Job type</label>
          <select
            value={form.type}
            onChange={(event) => updateField("type", event.target.value as JobType)}
            className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-slate-900"
          >
            {jobTypes.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Priority</label>
          <select
            value={form.priority}
            onChange={(event) => updateField("priority", event.target.value as JobPriority)}
            className="h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-slate-900"
          >
            {priorities.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2 lg:col-span-2">
          <label className="text-sm font-medium text-slate-700">Summary</label>
          <textarea
            value={form.summary}
            onChange={(event) => updateField("summary", event.target.value)}
            rows={4}
            placeholder="Describe the requested field scope and what success looks like on site."
            className="w-full rounded-lg border border-slate-300 px-3 py-3 text-sm outline-none transition focus:border-slate-900"
            required
          />
        </div>

        <div className="space-y-2 lg:col-span-2">
          <label className="text-sm font-medium text-slate-700">Internal notes</label>
          <textarea
            value={form.notes}
            onChange={(event) => updateField("notes", event.target.value)}
            rows={4}
            placeholder="Add access instructions, prep notes, or customer context for the team."
            className="w-full rounded-lg border border-slate-300 px-3 py-3 text-sm outline-none transition focus:border-slate-900"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <Link href={onCancelHref}>
          <Button variant="ghost">Cancel</Button>
        </Link>
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
