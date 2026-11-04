/**
 * Billing types for the ready-to-bill feature.
 */

export type BillingStatus = "unbilled" | "billed" | "excluded";

/** A row in the ready-to-bill list. */
export interface ReadyToBillJob {
  id: string;
  jobNumber: string;
  customerName: string;
  propertyName: string;
  type: "Install" | "Service";
  completedAt: string;
  billingStatus: BillingStatus;
  qbInvoiceNumber: string | null;
  billedAt: string | null;
}

/** Payload for marking a job as billed. */
export interface MarkBilledInput {
  jobId: string;
  qbInvoiceNumber: string;
  billedAt: string; // ISO date string YYYY-MM-DD
}
