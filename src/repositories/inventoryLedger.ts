import "server-only";

import type {
  LedgerEntry,
  LedgerFilters,
  NewLedgerRow,
  StockLevel,
  TxnType,
} from "@/features/inventory/types/ledger";
import { throwInventoryDbError } from "./inventoryErrors";
import { getRepositoryContext } from "./supabaseContext";

interface StockRow {
  item_id: string;
  location_id: string;
  on_hand: number | string;
  min_qty: number | string | null;
  max_qty: number | string | null;
  updated_at: string;
}

interface TxnRow {
  id: string;
  txn_type: string;
  item_id: string;
  location_id: string;
  qty_delta: number | string;
  job_id: string | null;
  transfer_group_id: string | null;
  reverses_transaction_id: string | null;
  reason: string | null;
  unit_cost_cents: number | null;
  serial_unit_id: string | null;
  created_by: string;
  created_at: string;
}

const STOCK_COLUMNS = "item_id,location_id,on_hand,min_qty,max_qty,updated_at";
const TXN_COLUMNS =
  "id,txn_type,item_id,location_id,qty_delta,job_id,transfer_group_id,reverses_transaction_id,reason,unit_cost_cents,serial_unit_id,created_by,created_at";

// numeric columns can arrive as strings from PostgREST
const num = (value: number | string) => Number(value);
const numOrNull = (value: number | string | null) => (value == null ? null : Number(value));

function mapStock(row: StockRow): StockLevel {
  return {
    itemId: row.item_id,
    locationId: row.location_id,
    onHand: num(row.on_hand),
    minQty: numOrNull(row.min_qty),
    maxQty: numOrNull(row.max_qty),
    updatedAt: row.updated_at,
  };
}

function mapTxn(row: TxnRow): LedgerEntry {
  return {
    id: row.id,
    txnType: row.txn_type as TxnType,
    itemId: row.item_id,
    locationId: row.location_id,
    qtyDelta: num(row.qty_delta),
    jobId: row.job_id,
    transferGroupId: row.transfer_group_id,
    reversesTransactionId: row.reverses_transaction_id,
    reason: row.reason,
    unitCostCents: row.unit_cost_cents,
    serialUnitId: row.serial_unit_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export async function listStockLevels(filters: { locationId?: string; itemId?: string } = {}): Promise<StockLevel[]> {
  const { supabase, orgId } = await getRepositoryContext();
  let query = supabase.from("inventory_stock_levels").select(STOCK_COLUMNS).eq("org_id", orgId);
  if (filters.locationId) query = query.eq("location_id", filters.locationId);
  if (filters.itemId) query = query.eq("item_id", filters.itemId);
  const { data, error } = await query.limit(5000);
  if (error) throw new Error(error.message);
  return ((data ?? []) as StockRow[]).map(mapStock);
}

/**
 * Van locations that already have at least one count row.
 * Pages until every requested location is found or the ledger page runs out,
 * so a busy van cannot hide another van's first count-in.
 */
export async function listCountedLocationIds(locationIds: readonly string[]): Promise<Set<string>> {
  const wanted = [...new Set(locationIds.filter(Boolean))];
  const found = new Set<string>();
  if (wanted.length === 0) return found;
  const { supabase, orgId } = await getRepositoryContext();
  const pageSize = 1000;

  for (let offset = 0; offset < wanted.length; offset += 100) {
    const chunk = wanted.slice(offset, offset + 100);
    for (let from = 0; found.size < wanted.length; from += pageSize) {
      const { data, error } = await supabase
        .from("inventory_transactions")
        .select("location_id")
        .eq("org_id", orgId)
        .eq("txn_type", "count")
        .in("location_id", chunk)
        .order("created_at", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as Array<{ location_id: string }>;
      for (const row of rows) found.add(row.location_id);
      if (rows.length < pageSize) break;
    }
  }
  return found;
}

export async function getOnHand(itemId: string, locationId: string): Promise<number> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("inventory_stock_levels")
    .select("on_hand")
    .eq("org_id", orgId)
    .eq("item_id", itemId)
    .eq("location_id", locationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? num((data as { on_hand: number | string }).on_hand) : 0;
}

export async function listTransactions(filters: LedgerFilters = {}): Promise<LedgerEntry[]> {
  const { supabase, orgId } = await getRepositoryContext();
  let query = supabase.from("inventory_transactions").select(TXN_COLUMNS).eq("org_id", orgId);
  if (filters.itemId) query = query.eq("item_id", filters.itemId);
  if (filters.locationId) query = query.eq("location_id", filters.locationId);
  if (filters.jobId) query = query.eq("job_id", filters.jobId);
  if (filters.txnType) query = query.eq("txn_type", filters.txnType);
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as TxnRow[]).map(mapTxn);
}

/** The row plus, for a transfer, its partner row(s) in the same group. */
export async function getTransactionWithGroup(id: string): Promise<LedgerEntry[]> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("inventory_transactions")
    .select(TXN_COLUMNS)
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return [];
  const first = mapTxn(data as TxnRow);
  if (!first.transferGroupId) return [first];

  const group = await supabase
    .from("inventory_transactions")
    .select(TXN_COLUMNS)
    .eq("org_id", orgId)
    .eq("transfer_group_id", first.transferGroupId)
    .order("created_at", { ascending: true });
  if (group.error) throw new Error(group.error.message);
  return ((group.data ?? []) as TxnRow[]).map(mapTxn);
}

/**
 * Appends rows in ONE insert statement, so a transfer pair is atomic. The stock
 * cache is updated by a database trigger; this never writes stock levels.
 */
export async function appendLedgerRows(rows: readonly NewLedgerRow[], userId: string): Promise<LedgerEntry[]> {
  if (rows.length === 0) return [];
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("inventory_transactions")
    .insert(
      rows.map((row) => ({
        org_id: orgId,
        txn_type: row.txnType,
        item_id: row.itemId,
        location_id: row.locationId,
        qty_delta: row.qtyDelta,
        job_id: row.jobId ?? null,
        transfer_group_id: row.transferGroupId ?? null,
        reverses_transaction_id: row.reversesTransactionId ?? null,
        reason: row.reason ?? null,
        unit_cost_cents: row.unitCostCents ?? null,
        serial_unit_id: row.serialUnitId ?? null,
        created_by: userId,
      })),
    )
    .select(TXN_COLUMNS);
  if (error) throwInventoryDbError(error, "That entry was already reversed.");
  return ((data ?? []) as TxnRow[]).map(mapTxn);
}
