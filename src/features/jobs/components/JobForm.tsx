"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardPlus, FilePenLine } from "lucide-react";
import Link from "next/link";

import SurfaceCard from "@/components/layout/SurfaceCard";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/atlas";
import { AssignmentTimeOffWarning } from "@/features/calendar/components/AssignmentTimeOffWarning";
import { formatTeamLabel } from "@/lib/teamLabel";
import {
  estimateEquipmentBundles,
  getEstimateEquipmentBundle,
} from "@/features/installed-systems/utils/installedSystemsUtils";
import {
  applyCustomerAutocomplete,
  applyPropertyAutocomplete,
  type JobCustomerOption,
  type JobPropertyOption,
  type SmartSelectionState,
} from "@/features/jobs/utils/smartJobCreation";
import {
  propertiesForCustomer,
  propertyOptionDetail,
  type PropertyDraft,
} from "@/features/jobs/utils/propertyPicker";
import {
  parseDatetimeLocalInput,
  toDatetimeLocalValue,
  isValidTimeWindow,
  getTimeWindowError,
  deriveScheduledStartAt,
  deriveScheduledForDate,
} from "@/features/jobs/utils/schedulingTime";
import { DEFAULT_JOB_APPOINTMENT_HOUR } from "@/features/jobs/utils/appointmentWindow";
import {
  formatMissingJobFields,
  missingJobFormFields,
} from "@/features/jobs/utils/jobFormSubmit";

import type { JobAppointmentHour, JobPriority, JobType } from "../types/job"; import { RecordCombobox } from "./RecordCombobox";

const jobTypes: JobType[] = ["Install", "Service", "Maintenance", "Inspection", "Estimate", "Callback"];
const priorities: JobPriority[] = ["Low", "Medium", "High"];

export interface JobFormValues {
  estimateId?: string;
  equipmentBundleId?: string;
  title: string;
  customerName: string; customerId?: string | null; createNewCustomer?: boolean;
  propertyName: string; propertyId?: string | null; createNewProperty?: boolean;
  assignedTo: string;   assigneeIds?: string[];
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
  assignedTo: "", assigneeIds: [],
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
  scheduledEndAt?: string | null;
  arrivalWindowStartAt?: string | null;
  arrivalWindowEndAt?: string | null;
  scheduledFor?: string | null;
  appointmentHour?: number | null;
}): SchedulingFormFields {
  const primary =
    job.scheduledStartAt ??
    deriveScheduledStartAt(job.scheduledFor ?? null, (job.appointmentHour ?? DEFAULT_JOB_APPOINTMENT_HOUR) as JobAppointmentHour);
  return {
    scheduledStartAt: toDatetimeLocalValue(primary),
    scheduledEndAt: toDatetimeLocalValue(job.scheduledEndAt),
    arrivalWindowStartAt: toDatetimeLocalValue(job.arrivalWindowStartAt),
    arrivalWindowEndAt: toDatetimeLocalValue(job.arrivalWindowEndAt),
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
    customerName: values.customerName.trim(), customerId: values.customerId ?? null, createNewCustomer: values.createNewCustomer ?? false,
    propertyName: values.propertyName.trim(), propertyId: values.propertyId ?? null, createNewProperty: values.createNewProperty ?? false,
    assignedTo: values.assignedTo.trim(), assigneeIds: Array.from(new Set(values.assigneeIds ?? [])),
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
  /** Current user's role. When "tech", sensitive fields are disabled. */
  role?: string;
  initialValues?: Partial<JobFormValues>;
  customerOptions?: JobCustomerOption[];
  propertyOptions?: JobPropertyOption[];
  technicianOptions?: string[]; technicianProfiles?: { id: string; name: string }[];
  onSubmit: (values: JobFormValues) => Promise<void> | void; onCreateCustomer?: (name: string) => Promise<{ id: string; name: string }>; onCreateProperty?: (input: PropertyDraft & { customerId?: string }) => Promise<{ id: string; name: string }>;
  onCustomerSearch?: (text: string) => void; onPropertySearch?: (text: string, customerId?: string) => void;
  onCustomerSelected?: (customerId: string) => void;
}

export function JobForm({
  mode,
  cancelHref,
  role,
  initialValues,
  customerOptions = [],
  propertyOptions = [],
  technicianOptions = [], technicianProfiles = [], onCreateCustomer, onCreateProperty,
  onSubmit, onCustomerSearch, onPropertySearch, onCustomerSelected,
}: JobFormProps) {
  const [form, setForm] = useState<JobFormValues>({
    ...defaultJobFormValues,
    ...initialValues,
  });
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selection, setSelection] = useState<SmartSelectionState>({
    customerId: initialValues?.customerId ?? undefined,
    propertyId: initialValues?.propertyId ?? undefined,
  }); function toggleAssignee(id: string, checked: boolean) { setForm((current) => { const currentIds = current.assigneeIds ?? []; const nextIds = checked ? Array.from(new Set([...currentIds, id])) : currentIds.filter((value) => value !== id); const names = technicianProfiles.filter((profile) => nextIds.includes(profile.id)).map((profile) => profile.name); return { ...current, assigneeIds: nextIds, assignedTo: formatTeamLabel(names) }; }); setError(null); }

  const scopedPropertyOptions = useMemo(
    () => propertiesForCustomer(propertyOptions, selection.customerId),
    [propertyOptions, selection.customerId],
  );
  const propertyRecords = useMemo(
    () =>
      scopedPropertyOptions.map((property) => ({
        id: property.id,
        name: property.name,
        detail: propertyOptionDetail(property),
      })),
    [scopedPropertyOptions],
  );

  useEffect(() => {
    if (selection.customerId) onCustomerSelected?.(selection.customerId);
  }, [onCustomerSelected, selection.customerId]);

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

  const missingFields = useMemo(
    () =>
      missingJobFormFields(role, form, {
        scheduledWindowError,
        arrivalWindowError,
      }),
    [form, scheduledWindowError, arrivalWindowError, role],
  );
  const missingMessage = formatMissingJobFields(missingFields);
  const canSubmit = missingFields.length === 0;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!canSubmit) {
      setError(missingMessage ?? "Add the missing information before saving this job.");
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      const normalized = normalizeValues(form);
      // Resolve the customer: an explicitly picked id wins. Otherwise, if a
      // name was typed, match it against existing options (avoids duplicates
      // when the user types an exact existing name) or create it inline.
      // This makes the flow work even if the "+ Create new" click misfires —
      // the typed text is always synced into form state via onQueryChange.
      const resolveCustomerId = async (): Promise<string | null> => {
        if (normalized.customerId) return normalized.customerId;
        const name = normalized.customerName;
        if (!name) return null;
        const match = customerOptions.find(
          (o) => o.name.toLowerCase() === name.toLowerCase(),
        );
        if (match) return match.id;
        if (!onCreateCustomer) throw new Error("Customer creation is not available on this form.");
        const created = await onCreateCustomer(name);
        return created.id;
      };
      const resolvePropertyId = async (): Promise<string | null> => {
        if (normalized.propertyId) return normalized.propertyId;
        const name = normalized.propertyName;
        if (!name) return null;
        const match = scopedPropertyOptions.find(
          (option) => option.name.toLowerCase() === name.toLowerCase(),
        );
        if (match) return match.id;
        throw new Error("Choose a property for this customer, or add a new one with its address.");
      };
      const customerId = await resolveCustomerId();
      const propertyId = await resolvePropertyId();
      await onSubmit({ ...normalized, customerId, propertyId, createNewCustomer: false, createNewProperty: false });
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
  // Techs may only edit work summary, notes, and location — sensitive
  // scheduling/assignment fields are disabled for them.
  const isTech = role === "tech";
  const FormBadgeIcon = isCreateMode ? ClipboardPlus : FilePenLine;
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

      <form noValidate onSubmit={handleSubmit}>
        <SurfaceCard>
          <div className="grid gap-6 p-6 lg:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Job Title</label>
              <input
                value={form.title}
                onChange={(e) => updateField("title", e.target.value)}
                placeholder="Emergency condenser repair"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-red-500/40"
                aria-required="true"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Customer Name</label>
              {/* F18: native select replaces the datalist combobox so only a
                  real customer record can be picked — a typo can no longer
                  silently unlink the job. Name-valued options match the F6
                  pattern; the existing handleCustomerInput resolution and
                  property scoping are unchanged. */}
              <RecordCombobox label="Customer Name" disabled={isTech} options={customerOptions} value={form.customerName} onSelect={(name, id) => { setForm((p) => ({ ...p, customerName: name, customerId: id, createNewCustomer: false })); setSelection((p) => ({ ...p, customerId: id ?? undefined, propertyId: undefined })); }} onCreateNew={(name) => { setForm((p) => ({ ...p, customerName: name, customerId: null, createNewCustomer: true })); setSelection((p) => ({ ...p, customerId: undefined, propertyId: undefined })); setForm((p) => ({ ...p, propertyName: "", propertyId: null, createNewProperty: false })); }} onQueryChange={(text) => { setForm((p) => ({ ...p, customerName: text, customerId: null, createNewCustomer: false })); setSelection((p) => ({ ...p, customerId: undefined })); onCustomerSearch?.(text); }} required />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Property Name</label>
              {/* F18: native select replaces the datalist combobox. Options stay
                  scoped to the selected customer (same getScopedProperties
                  behavior as before); only real linked records can be picked. */}
              <RecordCombobox
                label="Property"
                disabled={isTech || form.customerName.trim().length === 0}
                options={propertyRecords}
                value={form.propertyName}
                createWithAddress
                placeholder={
                  form.customerName.trim()
                    ? "Search by name or address"
                    : "Choose a customer first"
                }
                onSelect={(name, id) => {
                  const property = scopedPropertyOptions.find((item) => item.id === id);
                  const detail = property ? propertyOptionDetail(property) : "";
                  setForm((current) => ({
                    ...current,
                    propertyName: name,
                    propertyId: id,
                    createNewProperty: false,
                    location: detail || current.location,
                  }));
                  setSelection((current) => ({ ...current, propertyId: id ?? undefined }));
                }}
                onCreateNew={() => undefined}
                onCreateAddress={async (draft) => {
                  if (!onCreateProperty) {
                    throw new Error("Property creation is not available on this form.");
                  }
                  let customerId = selection.customerId ?? form.customerId ?? undefined;
                  if (!customerId && form.customerName.trim() && onCreateCustomer) {
                    const createdCustomer = await onCreateCustomer(form.customerName.trim());
                    customerId = createdCustomer.id;
                    setForm((current) => ({
                      ...current,
                      customerName: createdCustomer.name,
                      customerId: createdCustomer.id,
                      createNewCustomer: false,
                    }));
                    setSelection((current) => ({ ...current, customerId: createdCustomer.id }));
                  }
                  const created = await onCreateProperty({ ...draft, customerId });
                  const detail = propertyOptionDetail({ address: draft.address, city: draft.city });
                  setForm((current) => ({
                    ...current,
                    customerId: customerId ?? current.customerId,
                    propertyName: created.name,
                    propertyId: created.id,
                    createNewProperty: false,
                    location: detail || current.location,
                  }));
                  setSelection((current) => ({
                    customerId: customerId ?? current.customerId,
                    propertyId: created.id,
                  }));
                }}
                onQueryChange={(text) => {
                  setForm((current) => ({
                    ...current,
                    propertyName: text,
                    propertyId: null,
                    createNewProperty: false,
                  }));
                  setSelection((current) => ({ ...current, propertyId: undefined }));
                  onPropertySearch?.(text, selection.customerId);
                }}
                required
              />
              {form.customerName.trim().length === 0 ? (
                <p className="text-xs text-slate-500">Choose a customer to see their properties.</p>
              ) : scopedPropertyOptions.length === 0 ? (
                <p className="text-xs text-slate-500">No properties yet. Add one with its address.</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Assigned Technician</label> {technicianProfiles.length > 0 && (<div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">{technicianProfiles.map((profile) => (<label key={profile.id} className="flex items-center gap-2 text-sm text-slate-200"><input type="checkbox" disabled={isTech} checked={(form.assigneeIds ?? []).includes(profile.id)} onChange={(e) => toggleAssignee(profile.id, e.target.checked)} className="h-4 w-4 rounded border-white/20 bg-white/[0.03]" />{profile.name}</label>))}</div>)}
              {technicianProfiles.length === 0 && (<select
                value={form.assignedTo}
                onChange={(e) => updateField("assignedTo", e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-red-500/40"
                aria-required="true"
                disabled={isTech}
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
              </select>)}
              <AssignmentTimeOffWarning
                assigneeIds={form.assigneeIds ?? []}
                scheduledStartAt={form.scheduledStartAt}
                scheduledEndAt={form.scheduledEndAt ?? ""}
              />
            </div>

            {/* Scheduling — PR3C clock-time fields */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">
                Scheduled Start <span className="text-red-400">*</span>
              </label>
              <DateTimePicker
                id="job-scheduled-start"
                disabled={isTech}
                ariaLabel="Scheduled start"
                value={form.scheduledStartAt}
                onChange={(next) => updateField("scheduledStartAt", next)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">
                Scheduled End <span className="text-slate-500">(optional)</span>
              </label>
              <DateTimePicker
                id="job-scheduled-end"
                disabled={isTech}
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
                aria-required="true"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200">Job Type</label>
              <select
                value={form.type}
                disabled={isTech}
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
                disabled={isTech}
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
                aria-required="true"
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
            {error ? (
              <p className="text-sm text-red-300" role="alert">
                {error}
              </p>
            ) : (
              <div />
            )}
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

              <Button type="submit" className="gap-2" disabled={isSaving}>
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
