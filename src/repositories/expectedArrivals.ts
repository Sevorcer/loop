import "server-only";

import type {
  ArrivalCreateInput,
  ArrivalPatch,
  ArrivalStatus,
  ExpectedArrival,
} from "@/features/inventory/types/arrivals";

import { throwInventoryDbError } from "./inventoryErrors";
import { getRepositoryContext } from "./supabaseContext";

// ---------------------------------------------------------------------------
// Expected arrivals (20261126300000_expected_arrivals.sql). Receiving goes through
// the receive_expected_arrival() RPC so the ledger entry and the status change land
// together. Who/when is stamped by triggers; errors carry an HTTP status.
// ---------------------------------------------------------------------------


interface ArrivalRow {
  id: string;
  item_id: string;
  location_id: string;
  qty: number | string;
  eta_date: string;
  status: string;
  for_job_id: string | null;
  supplier_note: string | null;
  receipt_transaction_id: string | null;
  created_at: string;
  updated_at: string;
  item: { name: string; sku: string | null; unit: string | null } | Array<{ name: string; sku: string | null; unit: string | null }> | null;
  location: { name: string } | Array<{ name: string }> | null;
  job: { job_number: string | null; title: string | null } | Array<{ job_number: string | null; title: string | null }> | null;
}

const ARRIVAL_COLUMNS =
  "id,item_id,location_id,qty,eta_date,status,for_job_id,supplier_note,receipt_transaction_id,created_at,updated_at," +
  "item:catalog_items(name,sku,unit),location:inventory_locations(name),job:jobs(job_number,title)";

function first<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function mapArrival(row: ArrivalRow): ExpectedArrival {
  const item = first(row.item);
  const location = first(row.location);
  const job = first(row.job);
  const jobLabel = job ? [job.job_number, job.title].filter(Boolean).join(" · ") : "";
  return {
    id: row.id,
    itemId: row.item_id,
    itemName: item?.name ?? "Item",
    itemSku: item?.sku ?? null,
    unit: item?.unit ?? null,
    locationId: row.location_id,
    locationName: location?.name ?? "Warehouse",
    qty: Number(row.qty),
    etaDate: row.eta_date,
    status: (["expected", "received", "cancelled"].includes(row.status) ? row.status : "expected") as ArrivalStatus,
    forJobId: row.for_job_id,
    forJobLabel: row.for_job_id ? jobLabel || "Job" : null,
    supplierNote: row.supplier_note,
    receiptTransactionId: row.receipt_transaction_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function notFound(message: string): never {
  throw Object.assign(new Error(message), { status: 404, code: "NOT_FOUND" });
}

/** Open arrivals first (soonest ETA), then the most recent history. */
export async function listExpectedArrivals(input: { includeClosed?: boolean; limit?: number } = {}): Promise<ExpectedArrival[]> {
  const { supabase, orgId } = await getRepositoryContext();
  const limit = Math.min(Math.max(input.limit ?? 300, 1), 500);

  const open = await supabase
    .from("inventory_expected_arrivals")
    .select(ARRIVAL_COLUMNS)
    .eq("org_id", orgId)
    .eq("status", "expected")
    .order("eta_date", { ascending: true })
    .order("id", { ascending: true })
    .limit(limit);
  if (open.error) throw new Error(open.error.message);
  const rows = (open.data ?? []) as unknown as ArrivalRow[];

  if (input.includeClosed) {
    const closed = await supabase
      .from("inventory_expected_arrivals")
      .select(ARRIVAL_COLUMNS)
      .eq("org_id", orgId)
      .neq("status", "expected")
      .order("updated_at", { ascending: false })
      .limit(50);
    if (closed.error) throw new Error(closed.error.message);
    rows.push(...((closed.data ?? []) as unknown as ArrivalRow[]));
  }
  return rows.map(mapArrival);
}

export async function getExpectedArrival(id: string): Promise<ExpectedArrival> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("inventory_expected_arrivals")
    .select(ARRIVAL_COLUMNS)
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) notFound("Arrival not found.");
  return mapArrival(data as unknown as ArrivalRow);
}

/** The shop: oldest active warehouse (matches default_fulfil_location() in the database). */
export async function getShopLocationId(): Promise<string | null> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("inventory_locations")
    .select("id")
    .eq("org_id", orgId)
    .eq("type", "warehouse")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as { id: string } | null)?.id ?? null;
}

export async function insertExpectedArrival(input: ArrivalCreateInput & { locationId: string }): Promise<string> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("inventory_expected_arrivals")
    .insert({
      org_id: orgId,
      item_id: input.itemId,
      location_id: input.locationId,
      qty: input.qty,
      eta_date: input.etaDate,
      for_job_id: input.forJobId,
      supplier_note: input.supplierNote,
    })
    .select("id")
    .single();
  if (error) throwInventoryDbError(error);
  return (data as { id: string }).id;
}

export async function updateExpectedArrival(id: string, patch: ArrivalPatch): Promise<void> {
  const { supabase, orgId } = await getRepositoryContext();
  const row: Record<string, unknown> = {};
  if (patch.cancel) row.status = "cancelled";
  if (patch.qty !== undefined) row.qty = patch.qty;
  if (patch.etaDate !== undefined) row.eta_date = patch.etaDate;
  if (patch.forJobId !== undefined) row.for_job_id = patch.forJobId;
  if (patch.supplierNote !== undefined) row.supplier_note = patch.supplierNote;

  const { data, error } = await supabase
    .from("inventory_expected_arrivals")
    .update(row)
    .eq("org_id", orgId)
    .eq("id", id)
    .select("id");
  if (error) throwInventoryDbError(error);
  if (!data || data.length === 0) notFound("Arrival not found.");
}

/** Posts the ledger `receive` and closes the arrival. Returns the item so the caller can re-check readiness. */
export async function rpcReceiveExpectedArrival(id: string): Promise<{ itemId: string; transactionId: string }> {
  const { supabase } = await getRepositoryContext();
  const { data, error } = await supabase.rpc("receive_expected_arrival", { p_arrival_id: id });
  if (error) {
    if (error.code === "P0002") notFound(error.message);
    throwInventoryDbError(error, error.message);
  }
  const result = data as { item_id: string; transaction_id: string };
  return { itemId: result.item_id, transactionId: result.transaction_id };
}

/** Expected (open) arrivals as the readiness engine reads them. */
export async function listOpenArrivalsForReadiness(): Promise<
  Array<{ id: string; itemId: string; qty: number; etaDate: string; forJobId: string | null }>
> {
  const { supabase, orgId } = await getRepositoryContext();
  const out: Array<{ id: string; itemId: string; qty: number; etaDate: string; forJobId: string | null }> = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("inventory_expected_arrivals")
      .select("id,item_id,qty,eta_date,for_job_id")
      .eq("org_id", orgId)
      .eq("status", "expected")
      .order("id", { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as unknown as Array<{ id: string; item_id: string; qty: number | string; eta_date: string; for_job_id: string | null }>;
    for (const row of page) {
      out.push({ id: row.id, itemId: row.item_id, qty: Number(row.qty), etaDate: row.eta_date, forJobId: row.for_job_id });
    }
    if (page.length < 1000) break;
  }
  return out;
}

