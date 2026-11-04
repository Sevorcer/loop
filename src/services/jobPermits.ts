import { listActivePermits as listActivePermitsRecord, type JobPermit, type PermitStatus } from "@/repositories/jobPermits";
export type { JobPermit, PermitStatus };
export function isPermitStatus(value: string): value is PermitStatus { return new Set(["applied","intake_scheduled","corrections_needed","resubmitted","waiting_on_city","issued"]).has(value); }
export async function listActivePermits(): Promise<JobPermit[]> { return listActivePermitsRecord(); }
