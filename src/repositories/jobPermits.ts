import "server-only";

import { getRepositoryContext } from "./supabaseContext";

// ---------------------------------------------------------------------------
// Job permits — per-job permit tracking for the office workflow.
// Follows the repositories/jobTasks.ts convention: throw on error.
// ---------------------------------------------------------------------------

export type PermitStatus =
  | "applied"
  | "intake_scheduled"
  | "corrections_needed"
  | "resubmitted"
  | "waiting_on_city"
  | "issued";

const VALID_STATUSES: ReadonlySet<string> = new Set<PermitStatus>([
  "applied",
  "intake_scheduled",
  "corrections_needed",
  "resubmitted",
  "waiting_on_city",
  "issued",
]);

export function isPermitStatus(value: string): value is PermitStatus {
  return VALID_STATUSES.has(value);
}

interface JobPermitRow {
  id: string;
  org_id: string;
  job_id: string;
  jurisdiction: string;
  permit_type: string;
  permit_number: string | null;
  status: string;
  applied_at: string | null;
  intake_appointment_at: string | null;
  issued_at: string | null;
  corrections_notes: string | null;
  notes: string | null;
  voided_at: string | null;
  voided_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobPermit {
  id: string;
  orgId: string;
  jobId: string;
  jurisdiction: string;
  permitType: string;
  permitNumber: string | null;
  status: PermitStatus;
  appliedAt: string | null;
  intakeAppointmentAt: string | null;
  issuedAt: string | null;
  correctionsNotes: string | null;
  notes: string | null;
  voidedAt: string | null;
  voidedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

const COLUMNS =
  "id,org_id,job_id,jurisdiction,permit_type,permit_number,status,applied_at,intake_appointment_at,issued_at,corrections_notes,notes,voided_at,voided_by,created_at,updated_at";

function mapRow(row: JobPermitRow): JobPermit {
  return {
    id: row.id,
    orgId: row.org_id,
    jobId: row.job_id,
    jurisdiction: row.jurisdiction,
    permitType: row.permit_type,
    permitNumber: row.permit_number,
    status: isPermitStatus(row.status) ? row.status : "applied",
    appliedAt: row.applied_at,
    intakeAppointmentAt: row.intake_appointment_at,
    issuedAt: row.issued_at,
    correctionsNotes: row.corrections_notes,
    notes: row.notes,
    voidedAt: row.voided_at,
    voidedBy: row.voided_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listJobPermits(jobId: string): Promise<JobPermit[]> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("job_permits")
    .select(COLUMNS)
    .eq("org_id", orgId)
    .eq("job_id", jobId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapRow(row as JobPermitRow));
}

export async function getPermitById(permitId: string): Promise<JobPermit> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("job_permits")
    .select(COLUMNS)
    .eq("org_id", orgId)
    .eq("id", permitId)
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data as JobPermitRow);
}

export interface CreatePermitInput {
  jobId: string;
  jurisdiction: string;
  permitType: string;
  permitNumber?: string | null;
  status?: PermitStatus;
  appliedAt?: string | null;
  intakeAppointmentAt?: string | null;
  issuedAt?: string | null;
  correctionsNotes?: string | null;
  notes?: string | null;
}

export async function createPermit(input: CreatePermitInput): Promise<JobPermit> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("job_permits")
    .insert({
      org_id: orgId,
      job_id: input.jobId,
      jurisdiction: input.jurisdiction,
      permit_type: input.permitType,
      permit_number: input.permitNumber ?? null,
      status: input.status ?? "applied",
      applied_at: input.appliedAt ?? null,
      intake_appointment_at: input.intakeAppointmentAt ?? null,
      issued_at: input.issuedAt ?? null,
      corrections_notes: input.correctionsNotes ?? null,
      notes: input.notes ?? null,
    })
    .select(COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data as JobPermitRow);
}

export interface UpdatePermitInput {
  jurisdiction?: string;
  permitType?: string;
  permitNumber?: string | null;
  status?: PermitStatus;
  appliedAt?: string | null;
  intakeAppointmentAt?: string | null;
  issuedAt?: string | null;
  correctionsNotes?: string | null;
  notes?: string | null;
}

export async function updatePermit(
  permitId: string,
  input: UpdatePermitInput,
): Promise<JobPermit> {
  const { supabase, orgId } = await getRepositoryContext();

  const update: Record<string, unknown> = {};
  if (input.jurisdiction !== undefined) update.jurisdiction = input.jurisdiction;
  if (input.permitType !== undefined) update.permit_type = input.permitType;
  if (input.permitNumber !== undefined) update.permit_number = input.permitNumber;
  if (input.status !== undefined) update.status = input.status;
  if (input.appliedAt !== undefined) update.applied_at = input.appliedAt;
  if (input.intakeAppointmentAt !== undefined) update.intake_appointment_at = input.intakeAppointmentAt;
  if (input.issuedAt !== undefined) update.issued_at = input.issuedAt;
  if (input.correctionsNotes !== undefined) update.corrections_notes = input.correctionsNotes;
  if (input.notes !== undefined) update.notes = input.notes;

  if (Object.keys(update).length === 0) {
    return getPermitById(permitId);
  }

  const { data, error } = await supabase
    .from("job_permits")
    .update(update)
    .eq("org_id", orgId)
    .eq("id", permitId)
    .select(COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data as JobPermitRow);
}

export async function voidPermit(
  permitId: string,
  userId: string,
): Promise<JobPermit> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("job_permits")
    .update({ voided_at: new Date().toISOString(), voided_by: userId })
    .eq("org_id", orgId)
    .eq("id", permitId)
    .select(COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data as JobPermitRow);
}

export async function unvoidPermit(permitId: string): Promise<JobPermit> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("job_permits")
    .update({ voided_at: null, voided_by: null })
    .eq("org_id", orgId)
    .eq("id", permitId)
    .select(COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data as JobPermitRow);
}

/**
 * List all non-voided permits across jobs for the org (used by office views).
 */
export async function listActivePermits(): Promise<JobPermit[]> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("job_permits")
    .select(COLUMNS)
    .eq("org_id", orgId)
    .is("voided_at", null)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapRow(row as JobPermitRow));
}
