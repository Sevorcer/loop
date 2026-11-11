import "server-only";

import type {
  MaterialEventInput,
  PullLineRow,
  PullQueueJob,
  PullResult,
  ReturnPalletResult,
  StrandedPallet,
} from "@/features/inventory/types/pulls";

import { throwInventoryDbError } from "./inventoryErrors";
import { getRepositoryContext } from "./supabaseContext";

// ---------------------------------------------------------------------------
// Pull flow (20261126500000_ledger_material_line_link.sql). Pulls and pallet returns
// are SECURITY INVOKER functions that post the paired ledger transfer and move the
// reservation, so the stock movement and the claim change land together. RLS applies
// as the caller (owner / manager / office write the ledger).
// ---------------------------------------------------------------------------

const CHUNK = 80;
const ACTIVE_FOR_PULL = ["Scheduled", "In Progress"];

function chunk<T>(items: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function rpcError(error: { code?: string; message: string }): never {
  if (error.code === "P0002") {
    throw Object.assign(new Error(error.message), { status: 404, code: "NOT_FOUND" });
  }
  throwInventoryDbError(error, error.message);
}

interface PullRpc {
  pallet_location_id: string;
  pulled: Array<{ line_id: string; item_id: string; qty: number | string }>;
  short: Array<{ line_id: string; item_id: string; qty: number | string; on_hand: number | string }>;
}

export async function rpcPullJobMaterials(jobId: string, lineId: string | null): Promise<PullResult> {
  const { supabase } = await getRepositoryContext();
  const { data, error } = await supabase.rpc("pull_job_materials", { p_job_id: jobId, p_line_id: lineId });
  if (error) rpcError(error);
  const result = data as unknown as PullRpc;
  return {
    palletLocationId: result.pallet_location_id,
    pulled: (result.pulled ?? []).map((row) => ({ lineId: row.line_id, itemId: row.item_id, qty: Number(row.qty) })),
    short: (result.short ?? []).map((row) => ({
      lineId: row.line_id,
      itemId: row.item_id,
      qty: Number(row.qty),
      onHand: Number(row.on_hand),
    })),
  };
}

export async function rpcReturnPalletToShop(jobId: string, note: string | null): Promise<ReturnPalletResult> {
  const { supabase } = await getRepositoryContext();
  const { data, error } = await supabase.rpc("return_pallet_to_shop", { p_job_id: jobId, p_note: note });
  if (error) rpcError(error);
  const result = data as unknown as {
    shop_location_id: string | null;
    returned: Array<{ item_id: string; qty: number | string }>;
  };
  return {
    shopLocationId: result.shop_location_id,
    returned: (result.returned ?? []).map((row) => ({ itemId: row.item_id, qty: Number(row.qty) })),
  };
}

interface QueueJobRow {
  job_id: string;
  jobs:
    | { job_number: string | null; title: string | null; status: string; scheduled_for: string | null }
    | Array<{ job_number: string | null; title: string | null; status: string; scheduled_for: string | null }>
    | null;
}

interface QueueLineRow {
  id: string;
  job_id: string;
  name: string;
  unit: string;
  quantity: number | string;
  catalog_item_id: string;
  is_optional: boolean;
  item:
    | { sku: string | null; is_stockable: boolean; tracking_mode?: string }
    | Array<{ sku: string | null; is_stockable: boolean; tracking_mode?: string }>
    | null;
}

const LINE_COLUMNS =
  "id,job_id,name,unit,quantity,catalog_item_id,is_optional," +
  "item:catalog_items!job_material_lines_item_same_org_fkey(sku,is_stockable,tracking_mode)";

/**
 * Confirmed plans on live jobs that have stock reserved or already on the pallet, soonest job
 * first. `onlyJobId` narrows it to one job (the printable pull list).
 */
export async function listPullQueueJobs(onlyJobId?: string): Promise<PullQueueJob[]> {
  const { supabase, orgId } = await getRepositoryContext();

  let planQuery = supabase
    .from("job_material_plans")
    .select("job_id,jobs!inner(job_number,title,status,scheduled_for,deleted_at)")
    .eq("org_id", orgId)
    .eq("status", "confirmed")
    .in("jobs.status", ACTIVE_FOR_PULL)
    .is("jobs.deleted_at", null)
    .limit(1000);
  if (onlyJobId) planQuery = planQuery.eq("job_id", onlyJobId);
  const plans = await planQuery;
  if (plans.error) throw new Error(plans.error.message);

  const jobs = new Map<string, PullQueueJob>();
  for (const row of (plans.data ?? []) as unknown as QueueJobRow[]) {
    const job = Array.isArray(row.jobs) ? row.jobs[0] : row.jobs;
    if (!job) continue;
    jobs.set(row.job_id, {
      jobId: row.job_id,
      jobNumber: job.job_number ?? "",
      jobTitle: job.title ?? "",
      status: job.status,
      scheduledFor: job.scheduled_for,
      lines: [],
    });
  }

  for (const group of chunk([...jobs.keys()])) {
    const lines = await supabase
      .from("job_material_lines")
      .select(LINE_COLUMNS)
      .eq("org_id", orgId)
      .in("job_id", group)
      .not("catalog_item_id", "is", null)
      .is("non_stock_reason", null)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(5000);
    if (lines.error) throw new Error(lines.error.message);

    const claims = await supabase
      .from("inventory_reservations")
      .select("line_id,qty,status")
      .eq("org_id", orgId)
      .in("job_id", group)
      .in("status", ["active", "pulled"])
      .limit(10000);
    if (claims.error) throw new Error(claims.error.message);
    const held = new Map<string, { reserved: number; pulled: number }>();
    for (const row of (claims.data ?? []) as unknown as Array<{ line_id: string; qty: number | string; status: string }>) {
      const entry = held.get(row.line_id) ?? { reserved: 0, pulled: 0 };
      if (row.status === "active") entry.reserved += Number(row.qty);
      else entry.pulled += Number(row.qty);
      held.set(row.line_id, entry);
    }

    for (const line of (lines.data ?? []) as unknown as QueueLineRow[]) {
      const item = Array.isArray(line.item) ? line.item[0] : line.item;
      if (!item?.is_stockable) continue;
      const claim = held.get(line.id) ?? { reserved: 0, pulled: 0 };
      if (claim.reserved === 0 && claim.pulled === 0) continue;
      const row: PullLineRow = {
        lineId: line.id,
        name: line.name,
        unit: line.unit,
        itemId: line.catalog_item_id,
        itemSku: item.sku ?? null,
        trackingMode: item.tracking_mode === "serialized" ? "serialized" : "quantity",
        required: Number(line.quantity),
        reserved: claim.reserved,
        pulled: claim.pulled,
        isOptional: line.is_optional,
      };
      jobs.get(line.job_id)?.lines.push(row);
    }
  }

  return [...jobs.values()]
    .filter((job) => job.lines.length > 0)
    .sort((a, b) =>
      (a.scheduledFor ?? "9999") === (b.scheduledFor ?? "9999")
        ? a.jobNumber.localeCompare(b.jobNumber)
        : (a.scheduledFor ?? "9999").localeCompare(b.scheduledFor ?? "9999"),
    );
}

interface StrandedRow {
  job_id: string;
  job_number: string | null;
  job_title: string | null;
  job_status: string;
  item_id: string;
  on_hand: number | string;
}

/** Pallet stock left on cancelled or deleted jobs (the inventory_stranded_pallets view). */
export async function listStrandedPallets(): Promise<StrandedPallet[]> {
  const { supabase, orgId } = await getRepositoryContext();
  const rows = await supabase
    .from("inventory_stranded_pallets")
    .select("job_id,job_number,job_title,job_status,item_id,on_hand")
    .limit(2000);
  if (rows.error) throw new Error(rows.error.message);
  const stranded = (rows.data ?? []) as unknown as StrandedRow[];
  if (stranded.length === 0) return [];

  const itemIds = [...new Set(stranded.map((row) => row.item_id))];
  const names = new Map<string, { name: string; unit: string | null }>();
  for (const group of chunk(itemIds)) {
    const items = await supabase.from("catalog_items").select("id,name,unit").eq("org_id", orgId).in("id", group);
    if (items.error) throw new Error(items.error.message);
    for (const item of (items.data ?? []) as unknown as Array<{ id: string; name: string; unit: string | null }>) {
      names.set(item.id, { name: item.name, unit: item.unit });
    }
  }

  const byJob = new Map<string, StrandedPallet>();
  for (const row of stranded) {
    const pallet = byJob.get(row.job_id) ?? {
      jobId: row.job_id,
      jobNumber: row.job_number ?? "",
      jobTitle: row.job_title ?? "",
      jobStatus: row.job_status,
      items: [],
    };
    const item = names.get(row.item_id);
    pallet.items.push({
      itemId: row.item_id,
      itemName: item?.name ?? "Item",
      unit: item?.unit ?? null,
      onHand: Number(row.on_hand),
    });
    byJob.set(row.job_id, pallet);
  }
  return [...byJob.values()].sort((a, b) => a.jobNumber.localeCompare(b.jobNumber));
}

export async function insertMaterialEvent(jobId: string, input: MaterialEventInput): Promise<void> {
  const { supabase, orgId } = await getRepositoryContext();
  const { error } = await supabase.from("job_material_events").insert({
    org_id: orgId,
    job_id: jobId,
    line_id: input.lineId,
    item_id: input.itemId,
    event_type: input.eventType,
    qty: input.qty,
    note: input.note,
  });
  if (error) throwInventoryDbError(error);
}
