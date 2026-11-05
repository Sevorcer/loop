/**
 * Job financial detail — the imported Service Fusion money picture for one
 * job (line items, invoices, payments), composed server-side.
 *
 * Visibility is owner-only by Collin's ruling (2026-11-04): the office does
 * not need company totals. The API enforces it; the UI also hides the
 * section for every other role.
 */

export interface JobLineItemRow {
  kind: string | null;
  name: string | null;
  description: string | null;
  qty: number | null;
  rateCents: number | null;
  totalCents: number | null;
  isDiscount: boolean;
}

export interface JobInvoiceRow {
  id: string;
  number: string | null;
  invoiceDate: string | null;
  totalCents: number | null;
  isPaid: boolean;
  terms: string | null;
  poNumber: string | null;
  /** Sum of payments applied to this invoice. */
  paidAppliedCents: number;
  /** True when the SF-era is_paid flag disagrees with the payments sum. */
  flagMismatch: boolean;
}

export interface JobPaymentRow {
  amountCents: number | null;
  receivedOn: string | null;
  paymentType: string | null;
  referenceNumber: string | null;
  memo: string | null;
  invoiceNumber: string | null;
}

export interface JobFinancials {
  summary: {
    /** job_financials.revenue_cents — the job price. */
    totalCents: number | null;
    invoicedCents: number;
    paidCents: number;
    balanceCents: number;
    /** True when any imported line items / invoices / payments exist. */
    hasImportedDetail: boolean;
  };
  lineItems: JobLineItemRow[];
  invoices: JobInvoiceRow[];
  payments: JobPaymentRow[];
}
