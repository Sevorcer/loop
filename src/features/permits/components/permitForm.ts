/** Office, manager, and owner. Mirrors `canEditPermits` in the permit service. */
export function canEditPermits(role: string | null | undefined): boolean {
  return role === "owner" || role === "manager" || role === "office";
}

export type PermitStatus =
  | "applied"
  | "intake_scheduled"
  | "corrections_needed"
  | "resubmitted"
  | "waiting_on_city"
  | "issued";

/** Title Case labels. Stored values stay the snake_case status keys. */
export const PERMIT_STATUS_OPTIONS: { value: PermitStatus; label: string }[] = [
  { value: "applied", label: "Applied" },
  { value: "intake_scheduled", label: "Intake Scheduled" },
  { value: "corrections_needed", label: "Corrections Needed" },
  { value: "resubmitted", label: "Resubmitted" },
  { value: "waiting_on_city", label: "Waiting on City" },
  { value: "issued", label: "Issued" },
];

export interface PermitFormValues {
  jurisdiction: string;
  permitType: string;
  permitNumber: string;
  status: PermitStatus;
  appliedAt: string;
  intakeAppointmentAt: string;
  issuedAt: string;
  correctionsNotes: string;
  notes: string;
}

/** Fields accepted by POST /api/jobs/:id/permits — the same set the edit panel saves. */
export interface PermitWriteBody {
  jurisdiction: string;
  permitType: string;
  permitNumber: string | null;
  status: PermitStatus;
  appliedAt: string | null;
  intakeAppointmentAt: string | null;
  issuedAt: string | null;
  correctionsNotes: string | null;
  notes: string | null;
}

export function emptyPermitFormValues(): PermitFormValues {
  return {
    jurisdiction: "",
    permitType: "",
    permitNumber: "",
    status: "applied",
    appliedAt: "",
    intakeAppointmentAt: "",
    issuedAt: "",
    correctionsNotes: "",
    notes: "",
  };
}

export function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  try {
    return iso.slice(0, 10);
  } catch {
    return "";
  }
}

export function permitFormValuesFromEdit(permit: {
  jurisdiction: string;
  permitType: string;
  permitNumber: string | null;
  status: PermitStatus;
  appliedAt: string | null;
  intakeAppointmentAt: string | null;
  issuedAt: string | null;
  correctionsNotes: string | null;
  notes: string | null;
}): PermitFormValues {
  return {
    jurisdiction: permit.jurisdiction,
    permitType: permit.permitType,
    permitNumber: permit.permitNumber ?? "",
    status: permit.status,
    appliedAt: toDateInputValue(permit.appliedAt),
    intakeAppointmentAt: toDateInputValue(permit.intakeAppointmentAt),
    issuedAt: toDateInputValue(permit.issuedAt),
    correctionsNotes: permit.correctionsNotes ?? "",
    notes: permit.notes ?? "",
  };
}

export function permitWriteBody(values: PermitFormValues): PermitWriteBody {
  return {
    jurisdiction: values.jurisdiction.trim(),
    permitType: values.permitType.trim(),
    permitNumber: values.permitNumber.trim() || null,
    status: values.status,
    appliedAt: values.appliedAt || null,
    intakeAppointmentAt: values.intakeAppointmentAt || null,
    issuedAt: values.issuedAt || null,
    correctionsNotes: values.correctionsNotes.trim() || null,
    notes: values.notes.trim() || null,
  };
}

/** Client-side gate before POST. Messages match the permit service. */
export function validatePermitCreate(input: {
  jobId: string | null;
  values: PermitFormValues;
}): string | null {
  if (!input.jobId) return "Select a job.";
  if (!input.values.jurisdiction.trim()) return "Jurisdiction is required.";
  if (!input.values.permitType.trim()) return "Permit type is required.";
  return null;
}
