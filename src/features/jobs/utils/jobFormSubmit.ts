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

export function canSubmitJobForm(
  role: string | null | undefined,
  form: JobFormSubmitFields,
  windows: {
    scheduledWindowError: string | null;
    arrivalWindowError: string | null;
  },
): boolean {
  if (windows.scheduledWindowError || windows.arrivalWindowError) {
    return false;
  }

  if (role === "tech") {
    return form.location.trim().length > 0 && form.summary.trim().length > 0;
  }

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

  return hasRequiredText && hasValidStart;
}
