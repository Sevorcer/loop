import {
  createPermit as createPermitRecord,
  getPermitById as getPermitByIdRecord,
  isPermitStatus,
  listActivePermits as listActivePermitsRecord,
  listJobPermits as listJobPermitsRecord,
  unvoidPermit as unvoidPermitRecord,
  updatePermit as updatePermitRecord,
  voidPermit as voidPermitRecord,
  type CreatePermitInput,
  type JobPermit,
  type PermitStatus,
  type UpdatePermitInput,
} from "@/repositories/jobPermits";

export type { JobPermit, PermitStatus, CreatePermitInput, UpdatePermitInput };
export { isPermitStatus };

// ---------------------------------------------------------------------------
// Permit status pipeline
// ---------------------------------------------------------------------------

/**
 * Valid transitions in the Seattle-style intake loop.
 * Simple cities can go applied → issued directly.
 * All non-voided statuses can transition to any other status — the pipeline
 * is descriptive, not a hard gate, matching Zowe's real workflow where cities
 * sometimes skip steps.
 */
const STATUS_ORDER: readonly PermitStatus[] = [
  "applied",
  "intake_scheduled",
  "corrections_needed",
  "resubmitted",
  "waiting_on_city",
  "issued",
];

export function getStatusOrder(): readonly PermitStatus[] {
  return STATUS_ORDER;
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function listJobPermits(jobId: string): Promise<JobPermit[]> {
  return listJobPermitsRecord(jobId);
}

export async function getPermitById(permitId: string): Promise<JobPermit> {
  return getPermitByIdRecord(permitId);
}

export async function createJobPermit(input: CreatePermitInput): Promise<JobPermit> {
  const jurisdiction = (input.jurisdiction ?? "").trim();
  if (!jurisdiction) {
    throw new Error("Jurisdiction is required.");
  }

  const permitType = (input.permitType ?? "").trim();
  if (!permitType) {
    throw new Error("Permit type is required.");
  }

  return createPermitRecord({ ...input, jurisdiction, permitType });
}

export async function updateJobPermit(
  permitId: string,
  input: UpdatePermitInput,
): Promise<JobPermit> {
  if (input.status !== undefined && !isPermitStatus(input.status)) {
    throw new Error(`Invalid permit status: ${input.status}`);
  }
  return updatePermitRecord(permitId, input);
}

// ---------------------------------------------------------------------------
// Void / un-void
// ---------------------------------------------------------------------------

export async function voidJobPermit(
  permitId: string,
  userId: string,
): Promise<JobPermit> {
  const permit = await getPermitByIdRecord(permitId);
  if (permit.voidedAt) {
    throw new Error("Permit is already voided.");
  }
  return voidPermitRecord(permitId, userId);
}

export async function unvoidJobPermit(permitId: string): Promise<JobPermit> {
  const permit = await getPermitByIdRecord(permitId);
  if (!permit.voidedAt) {
    throw new Error("Permit is not voided.");
  }
  return unvoidPermitRecord(permitId);
}

// ---------------------------------------------------------------------------
// Office views
// ---------------------------------------------------------------------------

export async function listActivePermits(): Promise<JobPermit[]> {
  return listActivePermitsRecord();
}

/** Office+ roles that can write permits. */
export function canEditPermits(role: string): boolean {
  return role === "owner" || role === "manager" || role === "office";
}
