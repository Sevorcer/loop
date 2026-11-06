import "server-only";

import type {
  ReconcileLineInput,
  ReconcileLineRow,
  ReconciliationStatus,
} from "@/features/inventory/types/reconciliation";
import { toRpcLines } from "@/features/inventory/utils/reconciliation";

import { throwInventoryDbError } from "./inventoryErrors";
import { getRepositoryContext } from "./supabaseContext";

// ---------------------------------------------------------------------------
// Closeout reconciliation (20261126600000_closeout_reconciliation.sql). The submit function is
// SECURITY DEFINER so an assigned technician can reconcile (they cannot write the ledger
// themselves); it re-checks role, org and job assignment. The override function runs as the
// caller. Reads go through RLS.
// ---------------------------------------------------------------------------

function rpcError(error: { code?: string; message: string }): never {
  if (error.code === "P0002") {
    throw Object.assign(new Error(error.message), { status: 404, code: "NOT_FOUND" });
  }
  throwInventoryDbError(error, error.message);
}

interface LineRow {
  id: string;
  name: string;
  unit: string;
  quantity: number | string;
  catalog_item_id: string;
  is_optional: boolean;
  stage: string;
  used_qty: number | string | null;
  returned_qty: number | string | null;
  recovered_qty: number | string | null;
  variance_reason: string | null;
  item: { item_kind: string | null } | Array<{ item_kind: string | null }> | null;
}

const LINE_COLUMNS =
  "id,name,unit,quantity,catalog_item_id,is_optional,stage,used_qty,returned_qty,recovered_qty,variance_reason," +
  "item:catalog_items!job_material_lines_item_same_org_fkey(item_kind)";

const toNumber = (value: number | string | null): number | null => (value === null ? null : Number(value));

export interface ReconciliationRecord {
  status: ReconciliationStatus;
  overrideReason: string | null;
}

/** Catalog-linked lines of the job with what is on the pallet for each. */
export async function listReconcileLines(jobId: string): Promise<ReconcileLineRow[]> {
  const { supabase, orgId } = await getRepositoryContext();
  const lines = await supabase
    .from("job_material_lines")
    .select(LINE_COLUMNS)
    .eq("org_id", orgId)
    .eq("job_id", jobId)
    .not("catalog_item_id", "is", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (lines.error) throw new Error(lines.error.message);
  const rows = (lines.data ?? []) as unknown as LineRow[];
  if (rows.length === 0) return [];

  const pulled = await supabase
    .from("inventory_reservations")
    .select("line_id,qty")
    .eq("org_id", orgId)
    .eq("job_id", jobId)
    .eq("status", "pulled");
  if (pulled.error) throw new Error(pulled.error.message);
  const pulledByLine = new Map<string, number>();
  for (const row of (pulled.data ?? []) as Array<{ line_id: string; qty: number | string }>) {
    pulledByLine.set(row.line_id, (pulledByLine.get(row.line_id) ?? 0) + Number(row.qty));
  }

  return rows.map((row) => {
    const item = Array.isArray(row.item) ? row.item[0] : row.item;
    return {
      lineId: row.id,
      name: row.name,
      unit: row.unit,
      itemId: row.catalog_item_id,
      itemKind: item?.item_kind ?? null,
      planned: Number(row.quantity),
      pulled: pulledByLine.get(row.id) ?? 0,
      isOptional: row.is_optional,
      reconciled: row.stage === "reconciled",
      usedQty: toNumber(row.used_qty),
      returnedQty: toNumber(row.returned_qty),
      recoveredQty: toNumber(row.recovered_qty),
      varianceReason: row.variance_reason,
    };
  });
}

export async function getReconciliationRecord(jobId: string): Promise<ReconciliationRecord | null> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("job_material_reconciliations")
    .select("status,override_reason")
    .eq("org_id", orgId)
    .eq("job_id", jobId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as { status: string; override_reason: string | null };
  return { status: row.status as ReconciliationStatus, overrideReason: row.override_reason };
}

/** True when the job has a confirmed plan. Closeout reconciliation only applies to those. */
export async function hasConfirmedPlan(jobId: string): Promise<boolean> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("job_material_plans")
    .select("id")
    .eq("org_id", orgId)
    .eq("job_id", jobId)
    .eq("status", "confirmed")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data !== null;
}

export async function rpcReconcileJobMaterials(
  jobId: string,
  lines: ReconcileLineInput[],
): Promise<{ lines: number; varianceLines: number }> {
  const { supabase } = await getRepositoryContext();
  const { data, error } = await supabase.rpc("reconcile_job_materials", {
    p_job_id: jobId,
    p_lines: toRpcLines(lines),
  });
  if (error) rpcError(error);
  const result = data as unknown as { lines: number; variance_lines: number };
  return { lines: result.lines, varianceLines: result.variance_lines };
}

export async function rpcOverrideMaterialReconciliation(jobId: string, reason: string): Promise<void> {
  const { supabase } = await getRepositoryContext();
  const { error } = await supabase.rpc("override_material_reconciliation", { p_job_id: jobId, p_reason: reason });
  if (error) rpcError(error);
}
