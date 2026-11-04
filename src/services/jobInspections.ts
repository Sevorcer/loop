import {
  createCorrection as createCorrectionRecord,
  createInspection as createInspectionRecord,
  deleteCorrection as deleteCorrectionRecord,
  getInspectionById as getInspectionByIdRecord,
  isInspectionBookedBy,
  isInspectionResult,
  isInspectionType,
  listAllInspections as listAllInspectionsRecord,
  listCorrections as listCorrectionsRecord,
  listJobInspections as listJobInspectionsRecord,
  updateCorrectionComplete as updateCorrectionCompleteRecord,
  updateInspection as updateInspectionRecord,
  type CreateInspectionInput,
  type InspectionBookedBy,
  type InspectionCorrection,
  type InspectionResult,
  type InspectionType,
  type JobInspection,
  type UpdateInspectionInput,
} from "@/repositories/jobInspections";

export type {
  CreateInspectionInput,
  InspectionBookedBy,
  InspectionCorrection,
  InspectionResult,
  InspectionType,
  JobInspection,
  UpdateInspectionInput,
};
export { isInspectionBookedBy, isInspectionResult, isInspectionType };

// ---------------------------------------------------------------------------
// CRUD — inspections
// ---------------------------------------------------------------------------

export async function listJobInspections(jobId: string): Promise<JobInspection[]> {
  return listJobInspectionsRecord(jobId);
}

export async function getInspectionById(inspectionId: string): Promise<JobInspection> {
  return getInspectionByIdRecord(inspectionId);
}

export async function createJobInspection(input: CreateInspectionInput): Promise<JobInspection> {
  if (!isInspectionType(input.inspectionType)) {
    throw new Error(`Invalid inspection type: ${input.inspectionType}`);
  }
  if (!isInspectionBookedBy(input.bookedBy)) {
    throw new Error(`Invalid booked_by value: ${input.bookedBy}`);
  }
  return createInspectionRecord(input);
}

export async function updateJobInspection(
  inspectionId: string,
  input: UpdateInspectionInput,
): Promise<JobInspection> {
  if (input.inspectionType !== undefined && !isInspectionType(input.inspectionType)) {
    throw new Error(`Invalid inspection type: ${input.inspectionType}`);
  }
  if (input.bookedBy !== undefined && !isInspectionBookedBy(input.bookedBy)) {
    throw new Error(`Invalid booked_by value: ${input.bookedBy}`);
  }
  if (input.result !== undefined && !isInspectionResult(input.result)) {
    throw new Error(`Invalid inspection result: ${input.result}`);
  }
  return updateInspectionRecord(inspectionId, input);
}

// ---------------------------------------------------------------------------
// CRUD — corrections
// ---------------------------------------------------------------------------

export async function listInspectionCorrections(
  inspectionId: string,
): Promise<InspectionCorrection[]> {
  return listCorrectionsRecord(inspectionId);
}

export async function addCorrection(
  inspectionId: string,
  rawDescription: string,
): Promise<InspectionCorrection> {
  const description = rawDescription.trim();
  if (!description) {
    throw new Error("Correction description is required.");
  }
  return createCorrectionRecord(inspectionId, description);
}

export async function toggleCorrectionComplete(
  correctionId: string,
  isComplete: boolean,
): Promise<InspectionCorrection> {
  return updateCorrectionCompleteRecord(correctionId, isComplete);
}

export async function removeCorrection(correctionId: string): Promise<void> {
  return deleteCorrectionRecord(correctionId);
}

// ---------------------------------------------------------------------------
// Office views
// ---------------------------------------------------------------------------

export async function listAllInspections(): Promise<JobInspection[]> {
  return listAllInspectionsRecord();
}

/** Office+ roles that can write inspections. */
export function canEditInspections(role: string): boolean {
  return role === "owner" || role === "manager" || role === "office";
}
