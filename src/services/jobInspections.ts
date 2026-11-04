import { listAllInspections as listAllInspectionsRecord, type InspectionBookedBy, type InspectionResult, type InspectionType, type JobInspection } from "@/repositories/jobInspections";
export type { InspectionBookedBy, InspectionResult, InspectionType, JobInspection };
export async function listAllInspections(): Promise<JobInspection[]> { return listAllInspectionsRecord(); }
