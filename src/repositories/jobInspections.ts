import "server-only";

import { getRepositoryContext } from "./supabaseContext";

// ---------------------------------------------------------------------------
// Job inspections — per-job inspection tracking.
// ---------------------------------------------------------------------------

export type InspectionType = "rough_in" | "cover" | "final" | "other";
export type InspectionBookedBy = "office" | "gc_or_super" | "customer";
export type InspectionResult =
  | "scheduled"
  | "passed"
  | "failed"
  | "partial"
  | "rescheduled_by_city";

const VALID_TYPES: ReadonlySet<string> = new Set<InspectionType>([
  "rough_in", "cover", "final", "other",
]);
const VALID_BOOKED_BY: ReadonlySet<string> = new Set<InspectionBookedBy>([
  "office", "gc_or_super", "customer",
]);
const VALID_RESULTS: ReadonlySet<string> = new Set<InspectionResult>([
  "scheduled", "passed", "failed", "partial", "rescheduled_by_city",
]);

export function isInspectionType(v: string): v is InspectionType {
  return VALID_TYPES.has(v);
}
export function isInspectionBookedBy(v: string): v is InspectionBookedBy {
  return VALID_BOOKED_BY.has(v);
}
export function isInspectionResult(v: string): v is InspectionResult {
  return VALID_RESULTS.has(v);
}

// ---------------------------------------------------------------------------
// Row / model types
// ---------------------------------------------------------------------------

interface InspectionRow {
  id: string;
  org_id: string;
  job_id: string;
  permit_id: string | null;
  inspection_type: string;
  scheduled_date: string | null;
  scheduled_window: string | null;
  booked_by: string;
  inspector_name: string | null;
  result: string;
  result_date: string | null;
  rescheduled_date: string | null;
  parent_inspection_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobInspection {
  id: string;
  orgId: string;
  jobId: string;
  permitId: string | null;
  inspectionType: InspectionType;
  scheduledDate: string | null;
  scheduledWindow: string | null;
  bookedBy: InspectionBookedBy;
  inspectorName: string | null;
  result: InspectionResult;
  resultDate: string | null;
  rescheduledDate: string | null;
  parentInspectionId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

const INSPECTION_COLUMNS =
  "id,org_id,job_id,permit_id,inspection_type,scheduled_date,scheduled_window,booked_by,inspector_name,result,result_date,rescheduled_date,parent_inspection_id,notes,created_at,updated_at";

function mapInspection(row: InspectionRow): JobInspection {
  return {
    id: row.id,
    orgId: row.org_id,
    jobId: row.job_id,
    permitId: row.permit_id,
    inspectionType: isInspectionType(row.inspection_type) ? row.inspection_type : "other",
    scheduledDate: row.scheduled_date,
    scheduledWindow: row.scheduled_window,
    bookedBy: isInspectionBookedBy(row.booked_by) ? row.booked_by : "office",
    inspectorName: row.inspector_name,
    result: isInspectionResult(row.result) ? row.result : "scheduled",
    resultDate: row.result_date,
    rescheduledDate: row.rescheduled_date,
    parentInspectionId: row.parent_inspection_id,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listJobInspections(jobId: string): Promise<JobInspection[]> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("job_inspections")
    .select(INSPECTION_COLUMNS)
    .eq("org_id", orgId)
    .eq("job_id", jobId)
    .order("scheduled_date", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapInspection(row as InspectionRow));
}

export async function getInspectionById(inspectionId: string): Promise<JobInspection> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("job_inspections")
    .select(INSPECTION_COLUMNS)
    .eq("org_id", orgId)
    .eq("id", inspectionId)
    .single();

  if (error) throw new Error(error.message);
  return mapInspection(data as InspectionRow);
}

export interface CreateInspectionInput {
  jobId: string;
  permitId?: string | null;
  inspectionType: InspectionType;
  scheduledDate?: string | null;
  scheduledWindow?: string | null;
  bookedBy: InspectionBookedBy;
  inspectorName?: string | null;
  result?: InspectionResult;
  resultDate?: string | null;
  rescheduledDate?: string | null;
  parentInspectionId?: string | null;
  notes?: string | null;
}

export async function createInspection(input: CreateInspectionInput): Promise<JobInspection> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("job_inspections")
    .insert({
      org_id: orgId,
      job_id: input.jobId,
      permit_id: input.permitId ?? null,
      inspection_type: input.inspectionType,
      scheduled_date: input.scheduledDate ?? null,
      scheduled_window: input.scheduledWindow ?? null,
      booked_by: input.bookedBy,
      inspector_name: input.inspectorName ?? null,
      result: input.result ?? "scheduled",
      result_date: input.resultDate ?? null,
      rescheduled_date: input.rescheduledDate ?? null,
      parent_inspection_id: input.parentInspectionId ?? null,
      notes: input.notes ?? null,
    })
    .select(INSPECTION_COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return mapInspection(data as InspectionRow);
}

export interface UpdateInspectionInput {
  permitId?: string | null;
  inspectionType?: InspectionType;
  scheduledDate?: string | null;
  scheduledWindow?: string | null;
  bookedBy?: InspectionBookedBy;
  inspectorName?: string | null;
  result?: InspectionResult;
  resultDate?: string | null;
  rescheduledDate?: string | null;
  parentInspectionId?: string | null;
  notes?: string | null;
}

export async function updateInspection(
  inspectionId: string,
  input: UpdateInspectionInput,
): Promise<JobInspection> {
  const { supabase, orgId } = await getRepositoryContext();

  const update: Record<string, unknown> = {};
  if (input.permitId !== undefined) update.permit_id = input.permitId;
  if (input.inspectionType !== undefined) update.inspection_type = input.inspectionType;
  if (input.scheduledDate !== undefined) update.scheduled_date = input.scheduledDate;
  if (input.scheduledWindow !== undefined) update.scheduled_window = input.scheduledWindow;
  if (input.bookedBy !== undefined) update.booked_by = input.bookedBy;
  if (input.inspectorName !== undefined) update.inspector_name = input.inspectorName;
  if (input.result !== undefined) update.result = input.result;
  if (input.resultDate !== undefined) update.result_date = input.resultDate;
  if (input.rescheduledDate !== undefined) update.rescheduled_date = input.rescheduledDate;
  if (input.parentInspectionId !== undefined) update.parent_inspection_id = input.parentInspectionId;
  if (input.notes !== undefined) update.notes = input.notes;

  if (Object.keys(update).length === 0) {
    return getInspectionById(inspectionId);
  }

  const { data, error } = await supabase
    .from("job_inspections")
    .update(update)
    .eq("org_id", orgId)
    .eq("id", inspectionId)
    .select(INSPECTION_COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return mapInspection(data as InspectionRow);
}

/**
 * List all inspections across jobs for the org (office views).
 */
export async function listAllInspections(): Promise<JobInspection[]> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("job_inspections")
    .select(INSPECTION_COLUMNS)
    .eq("org_id", orgId)
    .order("scheduled_date", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapInspection(row as InspectionRow));
}

// ---------------------------------------------------------------------------
// Inspection corrections
// ---------------------------------------------------------------------------

interface CorrectionRow {
  id: string;
  org_id: string;
  inspection_id: string;
  description: string;
  is_complete: boolean;
  completed_at: string | null;
  created_at: string;
}

export interface InspectionCorrection {
  id: string;
  orgId: string;
  inspectionId: string;
  description: string;
  isComplete: boolean;
  completedAt: string | null;
  createdAt: string;
}

const CORRECTION_COLUMNS =
  "id,org_id,inspection_id,description,is_complete,completed_at,created_at";

function mapCorrection(row: CorrectionRow): InspectionCorrection {
  return {
    id: row.id,
    orgId: row.org_id,
    inspectionId: row.inspection_id,
    description: row.description,
    isComplete: row.is_complete,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

export async function listCorrections(inspectionId: string): Promise<InspectionCorrection[]> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("inspection_corrections")
    .select(CORRECTION_COLUMNS)
    .eq("org_id", orgId)
    .eq("inspection_id", inspectionId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapCorrection(row as CorrectionRow));
}

export async function createCorrection(
  inspectionId: string,
  description: string,
): Promise<InspectionCorrection> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("inspection_corrections")
    .insert({
      org_id: orgId,
      inspection_id: inspectionId,
      description,
    })
    .select(CORRECTION_COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return mapCorrection(data as CorrectionRow);
}

export async function updateCorrectionComplete(
  correctionId: string,
  isComplete: boolean,
): Promise<InspectionCorrection> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("inspection_corrections")
    .update({
      is_complete: isComplete,
      completed_at: isComplete ? new Date().toISOString() : null,
    })
    .eq("org_id", orgId)
    .eq("id", correctionId)
    .select(CORRECTION_COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return mapCorrection(data as CorrectionRow);
}

export async function deleteCorrection(correctionId: string): Promise<void> {
  const { supabase, orgId } = await getRepositoryContext();
  const { error } = await supabase
    .from("inspection_corrections")
    .delete()
    .eq("org_id", orgId)
    .eq("id", correctionId);

  if (error) throw new Error(error.message);
}
