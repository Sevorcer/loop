"use client";

import { useMemo, useState } from "react";
import { ClipboardPlus, FilePenLine } from "lucide-react";
import Link from "next/link";

import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/atlas";
import {
  estimateEquipmentBundles,
  getEstimateEquipmentBundle,
} from "@/features/installed-systems/utils/installedSystemsUtils";
import {
  applyCustomerAutocomplete,
  applyPropertyAutocomplete,
  getScopedProperties,
  type JobCustomerOption,
  type JobPropertyOption,
  type SmartSelectionState,
} from "@/features/jobs/utils/smartJobCreation";
import {
  parseDatetimeLocalInput,
  toDatetimeLocalValue,
  isValidTimeWindow,
  getTimeWindowError,
  deriveScheduledStartAt,
  deriveScheduledForDate,
} from "@/features/jobs/utils/schedulingTime";
import { DEFAULT_JOB_APPOINTMENT_HOUR } from "@/features/jobs/utils/appointmentWindow";

import type { JobAppointmentHour, JobPriority, JobType } from "../types/job";

const jobTypes: JobType[] = ["Install", "Service", "Maintenance", "Inspection", "Estimate", "Callback"];
const priorities: JobPriority[] = ["Low", "Medium", "High"];

export interface JobFormValues {
  estimateId?: string;
  equipmentBundleId?: string;
  title: string;
  customerName: string;
  propertyName: string;
  assignedTo: string;
  /** datetime-local value "YYYY-MM-DDTHH:mm" — the primary scheduling field. */
  scheduledStartAt: string;
  /** datetime-local value — optional committed end time. */
  scheduledEndAt: string;
  /** datetime-local value — optional arrival window start. */
  arrivalWindowStartAt: string;
  /** datetime-local value — optional arrival window end. */
  arrivalWindowEndAt: string;
  /**
   * Legacy calendar date ("YYYY-MM-DD") derived from the wall-clock date the
   * user picked. Kept in sync so schedule readers (calendar, daily plans) see
   * the job without a second scheduling step.
   */
  scheduledFor?: string | null;
  type: JobType;
  priority: JobPriority;
  location: string;
  summary: string;
  notes: string;
}

export const defaultJobFormValues: JobFormValues = {
  estimateId: "",
  equipmentBundleId: "",
  title: "",
  customerName: "",
  propertyName: "",
  assignedTo: "",
  scheduledStartAt: "",
  scheduledEndAt: "",
  arrivalWindowStartAt: "",
  arrivalWindowEndAt: "",
  type: "Service",
  priority: "Medium",
  location: "",
  summary: "",
  notes: "",
};

/** Subset of JobFormValues that represents the four scheduling datetime-local fields. */
export type SchedulingFormFields = Pick<
  JobFormValues,
  "scheduledStartAt" | "scheduledEndAt" | "arrivalWindowStartAt" | "arrivalWindowEndAt"
>;

/** Convert a stored Job's scheduling fields into JobFormValues scheduling fields. */
export function jobToFormScheduling(job: {
  scheduledStartAt?: string | null;
  scheduledFor?: string | null;
  appointmentHour?: number | null;
}): SchedulingFormFields {
  const primary =
    job.scheduledStartAt ??
    deriveScheduledStartAt(job.scheduledFor ?? null, (job.appointmentHour ?? DEFAULT_JOB_APPOINTMENT_HOUR) as JobAppointmentHour);
  return {
    scheduledStartAt: toDatetimeLocalValue(primary),
    scheduledEndAt: "",
    arrivalWindowStartAt: "",
    arrivalWindowEndAt: "",
  };
}

function clearEstimateFieldsIfNeeded(type: JobType) {
  if (type === "Install") {
    return {};
  }

  return {
    estimateId: "",
    equipmentBundleId: "",
  };
}

function normalizeValues(values: JobFormValues): JobFormValues {
  return {
    ...values,
    title: values.title.trim(),
    customerName: values.customerName.trim(),
    propertyName: values.propertyName.trim(),
    assignedTo: values.assignedTo.trim(),
    location: values.location.trim(),
    summary: values.summary.trim(),
    notes: values.notes.trim(),
    // Store offset-aware instants so timestamptz columns keep the wall-clock
    // time the user picked instead of misreading it as UTC.
    scheduledStartAt:
      parseDatetimeLocalInput(values.scheduledStartAt) ?? values.scheduledStartAt,
    scheduledEndAt:
      parseDatetimeLocalInput(values.scheduledEndAt) ?? values.scheduledEndAt,
    arrivalWindowStartAt:
      parseDatetimeLocalInput(values.arrivalWindowStartAt) ??
      values.arrivalWindowStartAt,
    arrivalWindowEndAt:
      parseDatetimeLocalInput(values.arrivalWindowEndAt) ?? values.arrivalWindowEndAt,
    // Derive the legacy calendar-date column from the wall-clock date picked
    // in the form, so the job appears on the calendar / in daily plans without
    // requiring a separate scheduling step.
    scheduledFor:
      deriveScheduledForDate(values.scheduledStartAt) ??
      values.scheduledFor ??
      null,
  };
}

interface JobFormProps {
  mode: "create" | "edit";
  cancelHref: string;
  initialValues?: Partial<JobFormValues>;
  customerOptions?: JobCustomerOption[];
  propertyOptions?: JobPropertyOption[];
  technicianOptions?: string[];
  onSubmit: (values: JobFormValues) => Promise<void> | void;
}

export function JobForm({
  mode,
  cancelHref,
  initialValues,
  customerOptions = [],
  propertyOptions = [],
  technicianOptions = [],
  onSubmit,
}: JobFormProps) {
  const [form, setForm] = useState<JobFormValues>({
    ...defaultJobFormValues,
    ...initialValues,
  });
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selection, setSelection] = useState<SmartSelectionState>({});

  const scopedPropertyOptions = useMemo(
    () => getScopedProperties(propertyOptions, selection.customerId),
    [propertyOptions, selection.customerId],
  );

  function updateField<K extends keyof JobFormValues>(
    key: K,
    value: JobFormValues[K],
  ) {
    setForm((current) => ({
      ...current,
      ...(key === "type" ? clearEstimateFieldsIfNeeded(value as JobType) : {}),
      [key]: value,
    }));
    setError(null);
  }

  function handleCustomerInput(value: string) {
    const selected = applyCustomerAutocomplete(customerOptions, value);
    const nextCustomerId = selected.state.customerId;
    const shouldRetainProperty = Boolean(
      nextCustomerId &&
        selection.propertyId &&
        propertyOptions.some(
          (property) =>
            property.id === selection.propertyId && property.customerId === nextCustomerId,
        ),
    );

    setSelection((current) => {
      return {
        customerId: nextCustomerId,
        propertyId: shouldRetainProperty ? current.propertyId : undefined,
      };
    });

    setForm((current) => ({
      ...current,
      customerName: selected.formPatch.customerName ?? value,
      propertyName: shouldRetainProperty ? current.propertyName : "",
    }));
    setError(null);
  }

  function handlePropertyInput(value: string) {
    const selected = applyPropertyAutocomplete(scopedPropertyOptions, value);
    setSelection({
      customerId: selected.state.customerId ?? selection.customerId,
      propertyId: selected.state.propertyId,
    });
    setForm((current) => ({
      ...current,
      propertyName: selected.formPatch.propertyName ?? value,
      customerName: selected.formPatch.customerName ?? current.customerName,
      location: selected.formPatch.location || current.location,
    }));
    setError(null);
  }

  function applyEstimateBundle(bundleId: string) {
    if (!bundleId) {
      setForm((current) => ({
        ...current,
        estimateId: "",
        equipmentBundleId: "",
      }));
      setError(null);
      return;
    }

    const bundle = getEstimateEquipmentBundle(bundleId);

    if (!bundle) {
      setForm((current) => ({
        ...current,
        estimateId: "",
        equipmentBundleId: "",
      }));
      return;
    }

    setForm((current) => ({
      ...current,
      estimateId: bundle.estimateId,
      equipmentBundleId: bundle.id,
      title: bundle.jobTitle,
      customerName: bundle.customerName,
      propertyName: bundle.propertyName,
      location: bundle.location,
      summary: bundle.jobSummary,
      notes: bundle.jobNotes,
    }));
    setError(null);
  }

  const parsedScheduledStart = useMemo(
    () => parseDatetimeLocalInput(form.scheduledStartAt),
    [form.scheduledStartAt],
  );
  const parsedScheduledEnd = useMemo(
    () => parseDatetimeLocalInput(form.scheduledEndAt),
    [form.scheduledEndAt],
  );
  const parsedArrivalStart = useMemo(
    () => parseDatetimeLocalInput(form.arrivalWindowStartAt),
    [form.arrivalWindowStartAt],
  );
  const parsedArrivalEnd = useMemo(
    () => parseDatetimeLocalInput(form.arrivalWindowEndAt),
    [form.arrivalWindowEndAt],
  );

  const scheduledWindowError = useMemo(
    () => getTimeWindowError(parsedScheduledStart, parsedScheduledEnd, "scheduled end time"),
    [parsedScheduledStart, parsedScheduledEnd],
  );

  const arrivalWindowError = useMemo(
    () => getTimeWindowError(parsedArrivalStart, parsedArrivalEnd, "arrival window end time"),
    [parsedArrivalStart, parsedArrivalEnd],
  );

  const canSubmit = useMemo(() => {
    const hasRequiredText =
      form.title.trim().length > 0 &&
      form.customerName.trim().length > 0 &&
      form.propertyName.trim().length > 0 &&
      form.assignedTo.trim().length > 0 &&
      form.location.trim().length > 0 &&
      form.summary.trim().length > 0;

    const hasValidStart =
      form.scheduledStartAt.length > 0 &&
      !Number.isNaN(new Date(form.scheduledStartAt).getTime());

    return hasRequiredText && hasValidStart && !scheduledWindowError && !arrivalWindowError;
  }, [form, scheduledWindowError, arrivalWindowError]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!canSubmit) {
      setError("Complete all required fields before saving this job.");
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      await onSubmit(normalizeValues(form));
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Failed to save job. Please check your connection and try again.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  const isCreateMode = mode === "create";
  const FormBadgeIcon = isCreateMode ? ClipboardPlus : FilePenLine;
  const formTitle = isCreateMode ? "Create Job" : "Edit Job";
  const formDescription = isCreateMode
    ? "Capture a new install, service, maintenance, or inspection job and route it into the execution workflow."
    : "Update job details and keep scheduling, assignment, and execution context accurate.";
  const formBadge = isCreateMode ? "New Workflow Entry" : "Workflow Update";
  const submitLabel = isCreateMode ? "Create Job" : "Save Changes";

  return (
    <div className="space-y-6">
      <SurfaceCard className="overflow-hidden">
        <div className="flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-red-300">
              <FormBadgeIcon className="h-3.5 w-3.5" />
              {formBadge}
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">{formTitle}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                {formDescription}
              </p>
            </div>
          </div>

          <Link href={cancelHref}>
            <Button variant="ghost" className="text-slate-300 hover:text-white">
              {isCreateMode ? "Back to Jobs" : "Back to Job"}
            </Button>
          </Link>
        </div>
      </SurfaceCard>

      <form onSubmit={handleSubmit}>
        <SurfaceCard>
          <div className="grid gap-6 p-6 lg:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Job Title</label>
              <input
                value={form.title}
                onChange={(e) => updateField("title", e.target.value)}
                placeholder="Emergency condenser repair"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-red-500/40"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Customer Name</label>
              {/* F18: native select replaces the datalist combobox so only a
                  real customer record can be picked — a typo can no longer
                  silently unlink the job. Name-valued options match the F6
                  pattern; the existing handleCustomerInput resolution and
                  property scoping are unchanged. */}
              <select
                value={form.customerName}
                onChange={(e) => handleCustomerInput(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-red-500/40"
                required
              >
                <option value="" disabled>
                  Select customer
                </option>
                {/* Keep a legacy free-text value selectable on edit so an
                    existing value is never lost when it predates the picker. */}
                {form.customerName.trim() &&
                  !customerOptions.some(
                    (customer) => customer.name === form.customerName.trim(),
                  ) && (
                    <option value={form.customerName.trim()}>
                      {form.customerName.trim()}
                    </option>
                  )}
                {customerOptions.map((customer) => (
                  <option key={customer.id} value={customer.name}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Property Name</label>
              {/* F18: native select replaces the datalist combobox. Options stay
                  scoped to the selected customer (same getScopedProperties
                  behavior as before); only real linked records can be picked. */}
              <select
                value={form.propertyName}
                onChange={(e) => handlePropertyInput(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-red-500/40"
                required
              >
                <option value="" disabled>
                  Select property
                </option>
                {/* Keep a legacy free-text value selectable on edit so an
                    existing value is never lost when it predates the picker. */}
                {form.propertyName.trim() &&
                  !scopedPropertyOptions.some(
                    (property) => property.name === form.propertyName.trim(),
                  ) && (
                    <option value={form.propertyName.trim()}>
                      {form.propertyName.trim()}
                    </option>
                  )}
                {scopedPropertyOptions.map((property) => (
                  <option key={property.id} value={property.name}>
                    {property.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Assigned Technician</label>
              <select
                value={form.assignedTo}
                onChange={(e) => updateField("assignedTo", e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-red-500/40"
                required
              >
                <option value="" disabled>
                  Select technician
                </option>
                {/* Keep a legacy free-text value selectable on edit so an
                    existing assignment is never lost when it predates the
                    technician roster. */}
                {form.assignedTo.trim() &&
                  !technicianOptions.includes(form.assignedTo.trim()) && (
                    <option value={form.assignedTo.trim()}>
                      {form.assignedTo.trim()}
                    </option>
                  )}
                {technicianOptions.map((technician) => (
                  <option key={technician} value={technician}>
                    {technician}
                  </option>
                ))}
              </select>
            </div>

            {/* Scheduling — PR3C clock-time fields */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">
                Scheduled Start <span className="text-red-400">*</span>
              </label>
              <DateTimePicker
                id="job-scheduled-start"
                ariaLabel="Scheduled start"
                value={form.scheduledStartAt}
                onChange={(next) => updateField("scheduledStartAt", next)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">
                Scheduled End <span className="text-slate-500">(optional)</span>
              </label>
              <DateTimePicker
                id="job-scheduled-end"
                ariaLabel="Scheduled end"
                value={form.scheduledEndAt}
                onChange={(next) => updateField("scheduledEndAt", next)}
                invalid={Boolean(scheduledWindowError)}
              />
              {scheduledWindowError && (
                <p className="text-xs text-red-400">{scheduledWindowError}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">
                Arrival Window Start <span className="text-slate-500">(optional)</span>
              </label>
              <DateTimePicker
                id="job-arrival-window-start"
                ariaLabel="Arrival window start"
                value={form.arrivalWindowStartAt}
                onChange={(next) => updateField("arrivalWindowStartAt", next)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">
                Arrival Window End <span className="text-slate-500">(optional)</span>
              </label>
              <DateTimePicker
                id="job-arrival-window-end"
                ariaLabel="Arrival window end"
                value={form.arrivalWindowEndAt}
                onChange={(next) => updateField("arrivalWindowEndAt", next)}
                invalid={Boolean(arrivalWindowError)}
              />
              {arrivalWindowError && (
                <p className="text-xs text-red-400">{arrivalWindowError}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Location</label>
              <input
                value={form.location}
                onChange={(e) => updateField("location", e.target.value)}
                placeholder="1450 Northside Blvd, Suite 100"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-red-500/40"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Job Type</label>
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
              <label className="text-sm font-medium text-slate-200">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => updateField("priority", e.target.value as JobPriority)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-red-500/40"
              >
                {priorities.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            {form.type === "Install" ? (
              <div className="space-y-2 lg:col-span-2">
                <label className="text-sm font-medium text-slate-200">
                  Accepted Estimate Equipment
                </label>
                <select
                  value={form.equipmentBundleId ?? ""}
                  onChange={(e) => applyEstimateBundle(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-blue-500/40"
                >
                  <option value="">Manual install job</option>
                  {estimateEquipmentBundles.map((bundle) => (
                    <option key={bundle.id} value={bundle.id}>
                      {bundle.estimateId} — {bundle.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs leading-5 text-slate-500">
                  Selecting a sold estimate establishes a technical identity and
                  lets LOOP inherit trusted equipment data into the installed
                  system record automatically.
                </p>
              </div>
            ) : null}

            <div className="space-y-2 lg:col-span-2">
              <label className="text-sm font-medium text-slate-200">Work Summary</label>
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
              <label className="text-sm font-medium text-slate-200">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                rows={4}
                placeholder="Add scheduling notes, access instructions, customer expectations, or internal prep details."
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-red-500/40"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-white/10 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            {error ? <p className="text-sm text-red-300">{error}</p> : <div />}
            <div className="flex items-center justify-end gap-3">
              <Link href={cancelHref}>
                <Button
                  type="button"
                  variant="ghost"
                  className="text-slate-300 hover:text-white"
                >
                  Cancel
                </Button>
              </Link>

              <Button type="submit" className="gap-2" disabled={!canSubmit || isSaving}>
                <FormBadgeIcon className="h-4 w-4" />
                {isSaving ? "Saving..." : submitLabel}
              </Button>
            </div>
          </div>
        </SurfaceCard>
      </form>
    </div>
  );
}
