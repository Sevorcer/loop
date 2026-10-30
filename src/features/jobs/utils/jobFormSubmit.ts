/**
 * Save-button rules for the job form.
 * Technicians edit location and summary only. The office fields stay disabled
 * for them, so those fields must not keep Save turned off.
 */

export interface JobFormSubmitFields {
  title: string;
  customerName: string;
  propertyName: string;
  assignedTo: string;
  location: string;
  summary: string;
  scheduledStartAt: string;
}

export function missingJobFormFields(
  role: string | null | undefined,
  form: JobFormSubmitFields,
  windows: {
    scheduledWindowError: string | null;
    arrivalWindowError: string | null;
  },
): string[] {
  const missing: string[] = [];

  if (role !== "tech") {
    if (form.title.trim().length === 0) missing.push("Job title");
    if (form.customerName.trim().length === 0) missing.push("Customer");
    if (form.propertyName.trim().length === 0) missing.push("Property");
    if (
      form.scheduledStartAt.length === 0 ||
      Number.isNaN(new Date(form.scheduledStartAt).getTime())
    ) {
      missing.push("Scheduled start");
    }
  }

  if (form.location.trim().length === 0) missing.push("Location");
  if (form.summary.trim().length === 0) missing.push("Work summary");
  if (windows.scheduledWindowError) missing.push(windows.scheduledWindowError);
  if (windows.arrivalWindowError) missing.push(windows.arrivalWindowError);

  return missing;
}

export function formatMissingJobFields(fields: string[]): string | null {
  if (fields.length === 0) return null;
  return `Add the missing information: ${fields.join(", ")}.`;
}

export function missingPersistedJobFields(input: {
  title: string;
  customerName: string;
  propertyName: string;
  assignedTo: string;
  location: string;
  summary: string;
}): string[] {
  const missing: string[] = [];
  if (!input.title.trim()) missing.push("Job title");
  if (!input.customerName.trim()) missing.push("Customer");
  if (!input.propertyName.trim()) missing.push("Property");
  if (!input.location.trim()) missing.push("Location");
  if (!input.summary.trim()) missing.push("Work summary");
  return missing;
}

export function canSubmitJobForm(
  role: string | null | undefined,
  form: JobFormSubmitFields,
  windows: {
    scheduledWindowError: string | null;
    arrivalWindowError: string | null;
  },
): boolean {
  return missingJobFormFields(role, form, windows).length === 0;
}
