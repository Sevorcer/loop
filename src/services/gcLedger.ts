import "server-only";

import type {
  GcLedgerEntry,
  GcChangeOrder,
  GcLedgerEntryWriteInput,
  GcChangeOrderWriteInput,
  GcBuilderRollup,
  GcContact,
} from "@/features/gc-ledger/types/gcLedger";
import type { SessionRepositoryContextInput } from "@/repositories/supabaseContext";
import {
  listLedgerEntriesForBuilder,
  getLedgerEntry,
  createLedgerEntry,
  updateLedgerEntry,
  deleteLedgerEntry,
  listChangeOrders,
  createChangeOrder,
  updateChangeOrder,
  deleteChangeOrder,
  getBuilderContacts,
  getBuilderRollup,
  listBuildersWithRollups,
} from "@/repositories/gcLedger";

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function validateCents(value: unknown, field: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`${field} must be a finite number.`);
  if (!Number.isInteger(n)) throw new Error(`${field} must be an integer (cents).`);
  return n;
}

function validateDate(value: unknown, field: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  const s = String(value);
  // Basic YYYY-MM-DD check
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new Error(`${field} must be a date in YYYY-MM-DD format.`);
  }
  return s;
}

// ---------------------------------------------------------------------------
// Ledger entry operations
// ---------------------------------------------------------------------------

export async function getGcLedgerEntries(
  parentCustomerId: string,
  ctx?: SessionRepositoryContextInput,
): Promise<GcLedgerEntry[]> {
  return listLedgerEntriesForBuilder(parentCustomerId, ctx);
}

export async function getGcLedgerEntry(
  entryId: string,
  ctx?: SessionRepositoryContextInput,
): Promise<GcLedgerEntry | null> {
  return getLedgerEntry(entryId, ctx);
}

export async function createGcLedgerEntry(
  input: GcLedgerEntryWriteInput,
  ctx?: SessionRepositoryContextInput,
): Promise<GcLedgerEntry> {
  if (!input.jobId) throw new Error("jobId is required.");

  const validated: GcLedgerEntryWriteInput = {
    jobId: input.jobId,
    estimateNumber: String(input.estimateNumber ?? ""),
    gcPoNumber: String(input.gcPoNumber ?? ""),
    dateSent: validateDate(input.dateSent, "dateSent"),
    dateReceived: validateDate(input.dateReceived, "dateReceived"),
    balanceCents: input.balanceCents !== undefined
      ? validateCents(input.balanceCents, "balanceCents")
      : 0,
    retainerCents: input.retainerCents !== undefined
      ? validateCents(input.retainerCents, "retainerCents")
      : 0,
    notes: String(input.notes ?? ""),
  };

  return createLedgerEntry(validated, ctx);
}

export async function updateGcLedgerEntry(
  entryId: string,
  input: Partial<GcLedgerEntryWriteInput>,
  ctx?: SessionRepositoryContextInput,
): Promise<GcLedgerEntry | null> {
  const validated: Partial<GcLedgerEntryWriteInput> = {};

  if (input.estimateNumber !== undefined) validated.estimateNumber = String(input.estimateNumber);
  if (input.gcPoNumber !== undefined) validated.gcPoNumber = String(input.gcPoNumber);
  if (input.dateSent !== undefined) validated.dateSent = validateDate(input.dateSent, "dateSent");
  if (input.dateReceived !== undefined) validated.dateReceived = validateDate(input.dateReceived, "dateReceived");
  if (input.balanceCents !== undefined) validated.balanceCents = validateCents(input.balanceCents, "balanceCents");
  if (input.retainerCents !== undefined) validated.retainerCents = validateCents(input.retainerCents, "retainerCents");
  if (input.notes !== undefined) validated.notes = String(input.notes);

  return updateLedgerEntry(entryId, validated, ctx);
}

export async function deleteGcLedgerEntry(
  entryId: string,
  ctx?: SessionRepositoryContextInput,
): Promise<boolean> {
  return deleteLedgerEntry(entryId, ctx);
}

// ---------------------------------------------------------------------------
// Change order operations
// ---------------------------------------------------------------------------

export async function getGcChangeOrders(
  ledgerEntryId: string,
  ctx?: SessionRepositoryContextInput,
): Promise<GcChangeOrder[]> {
  return listChangeOrders(ledgerEntryId, ctx);
}

export async function createGcChangeOrder(
  ledgerEntryId: string,
  input: GcChangeOrderWriteInput,
  ctx?: SessionRepositoryContextInput,
): Promise<GcChangeOrder> {
  const validated: GcChangeOrderWriteInput = {
    changeOrderNumber: String(input.changeOrderNumber ?? ""),
    amountCents: input.amountCents !== undefined
      ? validateCents(input.amountCents, "amountCents")
      : 0,
    description: String(input.description ?? ""),
  };

  return createChangeOrder(ledgerEntryId, validated, ctx);
}

export async function updateGcChangeOrder(
  orderId: string,
  input: Partial<GcChangeOrderWriteInput>,
  ctx?: SessionRepositoryContextInput,
): Promise<GcChangeOrder | null> {
  const validated: Partial<GcChangeOrderWriteInput> = {};

  if (input.changeOrderNumber !== undefined) validated.changeOrderNumber = String(input.changeOrderNumber);
  if (input.amountCents !== undefined) validated.amountCents = validateCents(input.amountCents, "amountCents");
  if (input.description !== undefined) validated.description = String(input.description);

  return updateChangeOrder(orderId, validated, ctx);
}

export async function deleteGcChangeOrder(
  orderId: string,
  ctx?: SessionRepositoryContextInput,
): Promise<boolean> {
  return deleteChangeOrder(orderId, ctx);
}

// ---------------------------------------------------------------------------
// Builder contacts
// ---------------------------------------------------------------------------

export async function getGcBuilderContacts(
  parentCustomerId: string,
  ctx?: SessionRepositoryContextInput,
): Promise<GcContact[]> {
  return getBuilderContacts(parentCustomerId, ctx);
}

// ---------------------------------------------------------------------------
// Roll-ups
// ---------------------------------------------------------------------------

export async function getGcBuilderRollup(
  parentCustomerId: string,
  parentCustomerName: string,
  ctx?: SessionRepositoryContextInput,
): Promise<GcBuilderRollup> {
  return getBuilderRollup(parentCustomerId, parentCustomerName, ctx);
}

export async function getGcBuildersOverview(
  ctx?: SessionRepositoryContextInput,
): Promise<GcBuilderRollup[]> {
  return listBuildersWithRollups(ctx);
}
