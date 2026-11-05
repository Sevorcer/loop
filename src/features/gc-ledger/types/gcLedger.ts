// ---------------------------------------------------------------------------
// GC Ledger — domain types
//
// The GC ledger tracks billing for builder (parent) customers. Each ledger
// entry maps 1:1 to a job under the builder's child customers.
//
// Key design decision: price and invoice number are NOT stored on the ledger
// entry — they are read from job_bids (Task 3) and jobs (Task 2) at query
// time so there is a single source of truth.
// ---------------------------------------------------------------------------

/** A single ledger row — one per job under a builder. */
export interface GcLedgerEntry {
  id: string;
  orgId: string;
  jobId: string;
  estimateNumber: string;
  gcPoNumber: string;
  dateSent: string | null;
  dateReceived: string | null;
  balanceCents: number;
  retainerCents: number;
  notes: string;
  createdAt: string;
  updatedAt: string;

  // --- Joined from other tables (read-only) ---
  /** Price from the current job bid (job_bids.amount_cents where is_current). */
  priceCents: number | null;
  /** Invoice number from jobs.qb_invoice_number (Task 2). */
  invoiceNumber: string | null;
  /** Job number for display. */
  jobNumber: string | null;
  /** Homeowner (child customer) name. */
  homeownerName: string | null;
  /** Homeowner phone. */
  homeownerPhone: string | null;
  /** Homeowner email. */
  homeownerEmail: string | null;
  /** Site address from the property or child customer. */
  siteAddress: string | null;
  /** Change orders attached to this entry. */
  changeOrders: GcChangeOrder[];
}

/** A repeatable change order under a ledger entry. */
export interface GcChangeOrder {
  id: string;
  orgId: string;
  ledgerEntryId: string;
  changeOrderNumber: string;
  amountCents: number;
  description: string;
  createdAt: string;
}

/** Roll-up stats for a single builder customer. */
export interface GcBuilderRollup {
  customerId: string;
  customerName: string;
  /** Sum of price (from job_bids) across all ledger entries. */
  totalBilledCents: number;
  /** Sum of balance_cents across all ledger entries. */
  totalOutstandingCents: number;
  /** Sum of retainer_cents across all ledger entries. */
  totalRetainerCents: number;
  /** Open callback count from the unified callback counting. */
  callbackCount: number;
  /** Number of ledger entries (jobs tracked in the ledger). */
  entryCount: number;
  /** Number of child customer sites under this builder. */
  siteCount: number;
  /** Total jobs across all child sites (regardless of ledger entries). */
  totalJobCount: number;
  /** Jobs currently in open status (scheduled, in_progress). */
  openJobCount: number;
}

/** Contact info for a super or PM on the builder. */
export interface GcContact {
  name: string;
  phone: string;
  email: string;
  role: "super" | "pm" | "other";
}

// --- Write shapes ---

export interface GcLedgerEntryWriteInput {
  jobId: string;
  estimateNumber?: string;
  gcPoNumber?: string;
  dateSent?: string | null;
  dateReceived?: string | null;
  balanceCents?: number;
  retainerCents?: number;
  notes?: string;
}

export interface GcChangeOrderWriteInput {
  changeOrderNumber?: string;
  amountCents?: number;
  description?: string;
}
