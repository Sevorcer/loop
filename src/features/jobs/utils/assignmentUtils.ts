import type { Job } from "../types/job";

export function validateAssignment(
  job: Job,
  contractorId: string
): { valid: true } | { valid: false; error: string } {
  if (!contractorId.trim()) {
    return { valid: false, error: "Contractor ID is required." };
  }

  const existing = job.contractorIds ?? [];

  if (existing.includes(contractorId)) {
    return {
      valid: false,
      error: "This contractor is already assigned to the job.",
    };
  }

  return { valid: true };
}

export function applyAssignment(job: Job, contractorId: string): Job {
  return {
    ...job,
    contractorIds: [...(job.contractorIds ?? []), contractorId],
  };
}

export function removeAssignment(job: Job, contractorId: string): Job {
  return {
    ...job,
    contractorIds: (job.contractorIds ?? []).filter((id) => id !== contractorId),
  };
}
