import "server-only";

import type {
  GcLedgerEntry,
  GcChangeOrder,
  GcLedgerEntryWriteInput,
  GcChangeOrderWriteInput,
  GcBuilderRollup,
  GcContact,
} from "@/features/gc-ledger/types/gcLedger";
import {
  CALLBACK_TYPE_QUERY_VARIANTS,
  OPEN_JOB_STATUS_EXCLUSION_FILTER,
} from "@/lib/callbacks";
import { getStatusVariants, type CanonicalJobStatus } from "@/lib/jobs/status";
import { getRepositoryContext, type SessionRepositoryContextInput } from "./supabaseContext";

// ---------------------------------------------------------------------------
// GC open-job definition
// ---------------------------------------------------------------------------

/**
 * Canonical statuses that count as an "open" job on the GC Overview. Mirrors
 * the app-wide definition (isOpenStatus / OPEN_JOB_STATUS_EXCLUSION_FILTER):
 * anything not Completed or Cancelled. Production stores Title Case values
 * ("Scheduled", "In Progress", "On Hold"), so the query must use
 * getStatusVariants() — never hand-written lowercase literals.
 */
export const GC_OPEN_JOB_STATUSES: readonly CanonicalJobStatus[] = [
  "Scheduled",
  "In Progress",
  "On Hold",
];

// ---------------------------------------------------------------------------
// Row shapes (database snake_case)
// ---------------------------------------------------------------------------

interface LedgerEntryRow {
  id: string;
  org_id: string;
  job_id: string;
  estimate_number: string;
  gc_po_number: string;
  date_sent: string | null;
  date_received: string | null;
  balance_cents: number;
  retainer_cents: number;
  notes: string;
  created_at: string;
  updated_at: string;
}

interface ChangeOrderRow {
  id: string;
  org_id: string;
  ledger_entry_id: string;
  change_order_number: string;
  amount_cents: number;
  description: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function mapEntry(row: LedgerEntryRow): Omit<
  GcLedgerEntry,
  "priceCents" | "invoiceNumber" | "jobNumber" | "homeownerName" | "homeownerPhone" | "homeownerEmail" | "siteAddress" | "changeOrders"
> {
  return {
    id: row.id,
    orgId: row.org_id,
    jobId: row.job_id,
    estimateNumber: row.estimate_number,
    gcPoNumber: row.gc_po_number,
    dateSent: row.date_sent,
    dateReceived: row.date_received,
    balanceCents: row.balance_cents,
    retainerCents: row.retainer_cents,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapChangeOrder(row: ChangeOrderRow): GcChangeOrder {
  return {
    id: row.id,
    orgId: row.org_id,
    ledgerEntryId: row.ledger_entry_id,
    changeOrderNumber: row.change_order_number,
    amountCents: row.amount_cents,
    description: row.description,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Ledger entry CRUD
// ---------------------------------------------------------------------------

/**
 * List all ledger entries for a builder (parent customer).
 * Walks parent → child customers → jobs → ledger entries,
 * joining price from job_bids and invoice # from jobs.
 */
export async function listLedgerEntriesForBuilder(
  parentCustomerId: string,
  ctx?: SessionRepositoryContextInput,
): Promise<GcLedgerEntry[]> {
  const { orgId, supabase } = await getRepositoryContext(ctx);

  // 1. Find child customer ids under this builder
  const { data: children } = await supabase
    .from("customers")
    .select("id")
    .eq("org_id", orgId)
    .eq("parent_customer_id", parentCustomerId);

  const childIds = (children ?? []).map((c: { id: string }) => c.id);
  if (childIds.length === 0) return [];

  // 2. Find jobs under those child customers
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id,job_number,customer_id,qb_invoice_number")
    .eq("org_id", orgId)
    .in("customer_id", childIds);

  if (!jobs || jobs.length === 0) return [];

  const jobIds = jobs.map((j: { id: string }) => j.id);
  const jobMap = new Map(
    jobs.map((j: { id: string; job_number?: string; customer_id: string; qb_invoice_number?: string }) => [
      j.id,
      { jobNumber: j.job_number ?? null, customerId: j.customer_id, invoiceNumber: j.qb_invoice_number ?? null },
    ]),
  );

  // 3. Load ledger entries for those jobs
  const { data: entries } = await supabase
    .from("gc_ledger_entries")
    .select("*")
    .eq("org_id", orgId)
    .in("job_id", jobIds)
    .order("created_at", { ascending: true });

  if (!entries || entries.length === 0) return [];

  // 4. Load current bid prices for those jobs (Task 3: job_bids)
  const { data: bids } = await supabase
    .from("job_bids")
    .select("job_id,amount_cents")
    .eq("org_id", orgId)
    .eq("is_current", true)
    .in("job_id", jobIds);

  const bidMap = new Map(
    (bids ?? []).map((b: { job_id: string; amount_cents: number }) => [b.job_id, b.amount_cents]),
  );

  // 5. Load change orders for all entries
  const entryIds = entries.map((e: LedgerEntryRow) => e.id);
  const { data: changeOrders } = await supabase
    .from("gc_change_orders")
    .select("*")
    .eq("org_id", orgId)
    .in("ledger_entry_id", entryIds)
    .order("created_at", { ascending: true });

  const coMap = new Map<string, GcChangeOrder[]>();
  for (const co of (changeOrders ?? []) as ChangeOrderRow[]) {
    const mapped = mapChangeOrder(co);
    const existing = coMap.get(co.ledger_entry_id) ?? [];
    existing.push(mapped);
    coMap.set(co.ledger_entry_id, existing);
  }

  // 6. Load child customer details (homeowner info)
  const relevantChildIds = [
    ...new Set(entries.map((e: LedgerEntryRow) => jobMap.get(e.job_id)?.customerId).filter(Boolean)),
  ] as string[];

  const { data: customerDetails } = await supabase
    .from("customers")
    .select("id,name,phone,email,street,city,zip,state")
    .in("id", relevantChildIds);

  const customerMap = new Map(
    (customerDetails ?? []).map((c: { id: string; name: string; phone?: string; email?: string; street?: string; city?: string; zip?: string; state?: string }) => [
      c.id,
      {
        name: c.name,
        phone: c.phone ?? "",
        email: c.email ?? "",
        address: [c.street, c.city, c.state, c.zip].filter(Boolean).join(", "),
      },
    ]),
  );

  // 7. Assemble full entries
  return entries.map((row: LedgerEntryRow) => {
    const base = mapEntry(row);
    const jobInfo = jobMap.get(row.job_id);
    const custInfo = jobInfo ? customerMap.get(jobInfo.customerId) : null;

    return {
      ...base,
      priceCents: bidMap.get(row.job_id) ?? null,
      invoiceNumber: jobInfo?.invoiceNumber ?? null,
      jobNumber: jobInfo?.jobNumber ?? null,
      homeownerName: custInfo?.name ?? null,
      homeownerPhone: custInfo?.phone ?? null,
      homeownerEmail: custInfo?.email ?? null,
      siteAddress: custInfo?.address ?? null,
      changeOrders: coMap.get(row.id) ?? [],
    } satisfies GcLedgerEntry;
  });
}

/** Get a single ledger entry by id. */
export async function getLedgerEntry(
  entryId: string,
  ctx?: SessionRepositoryContextInput,
): Promise<GcLedgerEntry | null> {
  const { orgId, supabase } = await getRepositoryContext(ctx);

  const { data } = await supabase
    .from("gc_ledger_entries")
    .select("*")
    .eq("id", entryId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (!data) return null;

  const row = data as LedgerEntryRow;
  const base = mapEntry(row);

  // Load job info
  const { data: job } = await supabase
    .from("jobs")
    .select("job_number,qb_invoice_number")
    .eq("id", row.job_id)
    .maybeSingle();

  // Load current bid
  const { data: bid } = await supabase
    .from("job_bids")
    .select("amount_cents")
    .eq("job_id", row.job_id)
    .eq("is_current", true)
    .maybeSingle();

  // Load change orders
  const { data: cos } = await supabase
    .from("gc_change_orders")
    .select("*")
    .eq("ledger_entry_id", entryId)
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });

  return {
    ...base,
    priceCents: (bid as { amount_cents: number } | null)?.amount_cents ?? null,
    invoiceNumber: (job as { qb_invoice_number?: string } | null)?.qb_invoice_number ?? null,
    jobNumber: (job as { job_number?: string } | null)?.job_number ?? null,
    homeownerName: null,
    homeownerPhone: null,
    homeownerEmail: null,
    siteAddress: null,
    changeOrders: ((cos ?? []) as ChangeOrderRow[]).map(mapChangeOrder),
  };
}

/** Create a new ledger entry. */
export async function createLedgerEntry(
  input: GcLedgerEntryWriteInput,
  ctx?: SessionRepositoryContextInput,
): Promise<GcLedgerEntry> {
  const { orgId, supabase } = await getRepositoryContext(ctx);

  const { data, error } = await supabase
    .from("gc_ledger_entries")
    .insert({
      org_id: orgId,
      job_id: input.jobId,
      estimate_number: input.estimateNumber ?? "",
      gc_po_number: input.gcPoNumber ?? "",
      date_sent: input.dateSent ?? null,
      date_received: input.dateReceived ?? null,
      balance_cents: input.balanceCents ?? 0,
      retainer_cents: input.retainerCents ?? 0,
      notes: input.notes ?? "",
    })
    .select()
    .single();

  if (error) throw error;

  const row = data as LedgerEntryRow;
  return {
    ...mapEntry(row),
    priceCents: null,
    invoiceNumber: null,
    jobNumber: null,
    homeownerName: null,
    homeownerPhone: null,
    homeownerEmail: null,
    siteAddress: null,
    changeOrders: [],
  };
}

/** Update a ledger entry. */
export async function updateLedgerEntry(
  entryId: string,
  input: Partial<GcLedgerEntryWriteInput>,
  ctx?: SessionRepositoryContextInput,
): Promise<GcLedgerEntry | null> {
  const { orgId, supabase } = await getRepositoryContext(ctx);

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.estimateNumber !== undefined) updates.estimate_number = input.estimateNumber;
  if (input.gcPoNumber !== undefined) updates.gc_po_number = input.gcPoNumber;
  if (input.dateSent !== undefined) updates.date_sent = input.dateSent;
  if (input.dateReceived !== undefined) updates.date_received = input.dateReceived;
  if (input.balanceCents !== undefined) updates.balance_cents = input.balanceCents;
  if (input.retainerCents !== undefined) updates.retainer_cents = input.retainerCents;
  if (input.notes !== undefined) updates.notes = input.notes;

  const { data, error } = await supabase
    .from("gc_ledger_entries")
    .update(updates)
    .eq("id", entryId)
    .eq("org_id", orgId)
    .select()
    .single();

  if (error) throw error;
  if (!data) return null;

  return getLedgerEntry(entryId, ctx);
}

/** Delete a ledger entry (cascades to change orders). */
export async function deleteLedgerEntry(
  entryId: string,
  ctx?: SessionRepositoryContextInput,
): Promise<boolean> {
  const { orgId, supabase } = await getRepositoryContext(ctx);

  const { error } = await supabase
    .from("gc_ledger_entries")
    .delete()
    .eq("id", entryId)
    .eq("org_id", orgId);

  if (error) throw error;
  return true;
}

// ---------------------------------------------------------------------------
// Change order CRUD
// ---------------------------------------------------------------------------

export async function listChangeOrders(
  ledgerEntryId: string,
  ctx?: SessionRepositoryContextInput,
): Promise<GcChangeOrder[]> {
  const { orgId, supabase } = await getRepositoryContext(ctx);

  const { data } = await supabase
    .from("gc_change_orders")
    .select("*")
    .eq("ledger_entry_id", ledgerEntryId)
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });

  return ((data ?? []) as ChangeOrderRow[]).map(mapChangeOrder);
}

export async function createChangeOrder(
  ledgerEntryId: string,
  input: GcChangeOrderWriteInput,
  ctx?: SessionRepositoryContextInput,
): Promise<GcChangeOrder> {
  const { orgId, supabase } = await getRepositoryContext(ctx);

  const { data, error } = await supabase
    .from("gc_change_orders")
    .insert({
      org_id: orgId,
      ledger_entry_id: ledgerEntryId,
      change_order_number: input.changeOrderNumber ?? "",
      amount_cents: input.amountCents ?? 0,
      description: input.description ?? "",
    })
    .select()
    .single();

  if (error) throw error;
  return mapChangeOrder(data as ChangeOrderRow);
}

export async function updateChangeOrder(
  orderId: string,
  input: Partial<GcChangeOrderWriteInput>,
  ctx?: SessionRepositoryContextInput,
): Promise<GcChangeOrder | null> {
  const { orgId, supabase } = await getRepositoryContext(ctx);

  const updates: Record<string, unknown> = {};
  if (input.changeOrderNumber !== undefined) updates.change_order_number = input.changeOrderNumber;
  if (input.amountCents !== undefined) updates.amount_cents = input.amountCents;
  if (input.description !== undefined) updates.description = input.description;

  const { data, error } = await supabase
    .from("gc_change_orders")
    .update(updates)
    .eq("id", orderId)
    .eq("org_id", orgId)
    .select()
    .single();

  if (error) throw error;
  if (!data) return null;
  return mapChangeOrder(data as ChangeOrderRow);
}

export async function deleteChangeOrder(
  orderId: string,
  ctx?: SessionRepositoryContextInput,
): Promise<boolean> {
  const { orgId, supabase } = await getRepositoryContext(ctx);

  const { error } = await supabase
    .from("gc_change_orders")
    .delete()
    .eq("id", orderId)
    .eq("org_id", orgId);

  if (error) throw error;
  return true;
}

// ---------------------------------------------------------------------------
// Builder contacts (Task 1 — reads customer_contacts for super/pm roles)
// ---------------------------------------------------------------------------

export async function getBuilderContacts(
  parentCustomerId: string,
  ctx?: SessionRepositoryContextInput,
): Promise<GcContact[]> {
  const { orgId, supabase } = await getRepositoryContext(ctx);

  const { data } = await supabase
    .from("customer_contacts")
    .select("name,phone,email,role")
    .eq("customer_id", parentCustomerId)
    .eq("org_id", orgId)
    .in("role", ["super", "pm"]);

  return (data ?? []).map(
    (c: { name: string; phone: string; email: string; role: string }) => ({
      name: c.name ?? "",
      phone: c.phone ?? "",
      email: c.email ?? "",
      role: c.role as "super" | "pm" | "other",
    }),
  );
}

// ---------------------------------------------------------------------------
// Builder roll-ups
// ---------------------------------------------------------------------------

/**
 * Compute roll-up stats for a single builder.
 * - Total billed = sum of current bid amounts across all jobs with ledger entries
 * - Total outstanding = sum of balance_cents
 * - Total retainer = sum of retainer_cents
 * - Callback count = open callbacks from unified counting (src/lib/callbacks.ts)
 */
export async function getBuilderRollup(
  parentCustomerId: string,
  parentCustomerName: string,
  ctx?: SessionRepositoryContextInput,
): Promise<GcBuilderRollup> {
  const { orgId, supabase } = await getRepositoryContext(ctx);

  // Child customer ids
  const { data: children } = await supabase
    .from("customers")
    .select("id")
    .eq("org_id", orgId)
    .eq("parent_customer_id", parentCustomerId);

  const childIds = (children ?? []).map((c: { id: string }) => c.id);

  if (childIds.length === 0) {
    return {
      customerId: parentCustomerId,
      customerName: parentCustomerName,
      totalBilledCents: 0,
      totalOutstandingCents: 0,
      totalRetainerCents: 0,
      callbackCount: 0,
      entryCount: 0,
      siteCount: 0,
      totalJobCount: 0,
      openJobCount: 0,
    };
  }

  // Jobs under child customers
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id")
    .eq("org_id", orgId)
    .in("customer_id", childIds);

  const jobIds = (jobs ?? []).map((j: { id: string }) => j.id);

  // Open jobs count — Scheduled / In Progress / On Hold in every stored
  // casing (STATUS_QUERY_VARIANTS). Rolls up jobs filed directly on the
  // builder parent as well as its child sites, matching how the app's
  // account-level open count works (countOpenJobsForCustomers).
  const { count: openJobCount } = await supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .in("customer_id", [parentCustomerId, ...childIds])
    .in("status", getStatusVariants(GC_OPEN_JOB_STATUSES));

  if (jobIds.length === 0) {
    return {
      customerId: parentCustomerId,
      customerName: parentCustomerName,
      totalBilledCents: 0,
      totalOutstandingCents: 0,
      totalRetainerCents: 0,
      callbackCount: 0,
      entryCount: 0,
      siteCount: childIds.length,
      totalJobCount: 0,
      openJobCount: openJobCount ?? 0,
    };
  }

  // Ledger entry totals
  const { data: entries } = await supabase
    .from("gc_ledger_entries")
    .select("balance_cents,retainer_cents,job_id")
    .eq("org_id", orgId)
    .in("job_id", jobIds);

  const ledgerEntries = (entries ?? []) as { balance_cents: number; retainer_cents: number; job_id: string }[];
  const totalOutstandingCents = ledgerEntries.reduce((sum, e) => sum + e.balance_cents, 0);
  const totalRetainerCents = ledgerEntries.reduce((sum, e) => sum + e.retainer_cents, 0);

  // Current bid totals (total billed)
  const ledgerJobIds = ledgerEntries.map((e) => e.job_id);
  let totalBilledCents = 0;
  if (ledgerJobIds.length > 0) {
    const { data: bids } = await supabase
      .from("job_bids")
      .select("amount_cents")
      .eq("org_id", orgId)
      .eq("is_current", true)
      .in("job_id", ledgerJobIds);

    totalBilledCents = (bids ?? []).reduce(
      (sum: number, b: { amount_cents: number }) => sum + b.amount_cents,
      0,
    );
  }

  // Callback count — uses the unified callback definition (PR #322)
  const { count: callbackCount } = await supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .in("customer_id", childIds)
    .in("type", CALLBACK_TYPE_QUERY_VARIANTS)
    .not("status", "in", OPEN_JOB_STATUS_EXCLUSION_FILTER);

  return {
    customerId: parentCustomerId,
    customerName: parentCustomerName,
    totalBilledCents,
    totalOutstandingCents,
    totalRetainerCents,
    callbackCount: callbackCount ?? 0,
    entryCount: ledgerEntries.length,
    siteCount: childIds.length,
    totalJobCount: jobIds.length,
    openJobCount: openJobCount ?? 0,
  };
}

/**
 * List all builders (parent customers that have child customers with jobs)
 * with their roll-up stats.
 */
export async function listBuildersWithRollups(
  ctx?: SessionRepositoryContextInput,
): Promise<GcBuilderRollup[]> {
  const { orgId, supabase } = await getRepositoryContext(ctx);

  // Find all customers that are parents (have at least one child customer)
  const { data: childCustomers } = await supabase
    .from("customers")
    .select("parent_customer_id")
    .eq("org_id", orgId)
    .not("parent_customer_id", "is", null);

  if (!childCustomers || childCustomers.length === 0) return [];

  // Unique parent ids
  const parentIds = [
    ...new Set(
      (childCustomers as { parent_customer_id: string }[]).map((c) => c.parent_customer_id),
    ),
  ];

  // Load parent customer names
  const { data: parents } = await supabase
    .from("customers")
    .select("id,name")
    .in("id", parentIds);

  const parentMap = new Map(
    (parents ?? []).map((p: { id: string; name: string }) => [p.id, p.name]),
  );

  // Compute roll-ups for each builder
  const rollups: GcBuilderRollup[] = [];
  for (const parentId of parentIds) {
    const name = parentMap.get(parentId) ?? "Unknown";
    const rollup = await getBuilderRollup(parentId, name, ctx);
    rollups.push(rollup);
  }

  return rollups;
}
