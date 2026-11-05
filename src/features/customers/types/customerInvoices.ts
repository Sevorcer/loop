/** One imported invoice shown on a customer account (read-only; QuickBooks owns invoicing). */
export interface CustomerInvoiceRow {
  id: string;
  number: string;
  invoiceDate: string | null;
  totalCents: number;
  isPaid: boolean;
  jobId: string | null;
  jobNumber: string | null;
  jobTitle: string | null;
  /** Customer that owns the invoice - a child job site when rolled into a parent. */
  customerId: string;
  customerName: string;
}

export interface CustomerInvoiceSummary {
  paidCents: number;
  outstandingCents: number;
  paidCount: number;
  awaitingCount: number;
}
