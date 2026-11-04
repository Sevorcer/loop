import "server-only";

import type { ReadyToBillJob, MarkBilledInput } from "@/features/billing/types/billing";
import {
  listReadyToBillJobs,
  markJobBilled,
  unmarkJobBilled,
  excludeJobFromBilling,
  unexcludeJobFromBilling,
} from "@/repositories/billing";

/**
 * List jobs ready to bill, scoped by job type (Install or Service).
 */
export async function getReadyToBillJobs(
  jobType: "Install" | "Service",
): Promise<ReadyToBillJob[]> {
  return listReadyToBillJobs(jobType);
}

/**
 * Mark a job as billed with a QuickBooks invoice number and date.
 */
export async function markBilled(
  input: MarkBilledInput,
  billedBy: string,
): Promise<boolean> {
  const { jobId, qbInvoiceNumber, billedAt } = input;

  if (!qbInvoiceNumber.trim()) {
    throw new Error("QuickBooks invoice number is required.");
  }
  if (!billedAt.trim()) {
    throw new Error("Billed date is required.");
  }

  return markJobBilled(jobId, qbInvoiceNumber.trim(), billedAt.trim(), billedBy);
}

/**
 * Un-mark a job as billed. Returns it to the ready-to-bill list.
 */
export async function unmarkBilled(jobId: string): Promise<boolean> {
  return unmarkJobBilled(jobId);
}

/**
 * Exclude a job from ever listing in ready-to-bill (warranty, no-charge, internal).
 */
export async function excludeFromBilling(jobId: string): Promise<boolean> {
  return excludeJobFromBilling(jobId);
}

/**
 * Un-exclude a job, returning it to the ready-to-bill list.
 */
export async function unexcludeFromBilling(jobId: string): Promise<boolean> {
  return unexcludeJobFromBilling(jobId);
}
