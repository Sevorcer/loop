// ============================================================
// Job material plans (Inventory Lane 4, PR B)
//
// A plan is the header for a job's material lines. Lines live in
// job_material_lines (same table the legacy checklist uses); the plan adds
// provenance (estimate / kit / manual), a draft → confirmed status, attached
// kits and an append-only history. Draft plans never reserve stock.
// ============================================================

import type { MaterialReadinessLevel } from "@/features/inventory/types/readiness";

import type { JobMaterialLine } from "./jobMaterials";

export const MATERIAL_PLAN_STATUSES = ["draft", "confirmed"] as const;
export type MaterialPlanStatus = (typeof MATERIAL_PLAN_STATUSES)[number];

export const MATERIAL_PLAN_ORIGINS = ["estimate", "kit", "manual", "mixed"] as const;
export type MaterialPlanOrigin = (typeof MATERIAL_PLAN_ORIGINS)[number];

export interface MaterialPlan {
  id: string;
  jobId: string;
  status: MaterialPlanStatus;
  generatedFrom: MaterialPlanOrigin;
  generatedAt: string;
  confirmedBy: string | null;
  confirmedAt: string | null;
  /** Worst line state, cached by the readiness engine; null = not computed / not applicable. */
  readinessState?: MaterialReadinessLevel | null;
  readinessReason?: string | null;
  readinessCheckedAt?: string | null;
}

export interface JobKitAttachment {
  id: string;
  kitId: string;
  kitName: string;
  /** Version the job was last synced to. */
  kitVersion: number;
  /** The kit's version today; greater than kitVersion = "Refresh from kit" has news. */
  currentKitVersion: number;
  multiplier: number;
  attachedAt: string;
}

export const MATERIAL_EVENT_TYPES = [
  "created",
  "qty_changed",
  "item_changed",
  "removed",
  "sku_linked",
  "kit_refreshed",
  "reserved",
  "released",
  "pulled",
  "used",
  "returned",
  "override",
] as const;
export type MaterialEventType = (typeof MATERIAL_EVENT_TYPES)[number];

export type MaterialEventOrigin = "user" | "generation" | "kit_refresh" | "system";

export interface MaterialLineEvent {
  id: string;
  lineId: string;
  lineName: string;
  eventType: MaterialEventType;
  origin: MaterialEventOrigin;
  fromQty: number | null;
  toQty: number | null;
  reason: string | null;
  actorId: string | null;
  createdAt: string;
}

/** What the job panel renders: the plan (null before one is generated), its lines and kits. */
export interface JobMaterialPlanView {
  plan: MaterialPlan | null;
  lines: JobMaterialLine[];
  kits: JobKitAttachment[];
  /** Lines with no catalog item and no "not stock" decision. */
  needsSkuCount: number;
}

/** A line the generator wants to add; persisted by generate_material_plan(). */
export interface PlanCandidateLine {
  name: string;
  quantity: number;
  unit: string;
  catalogItemId: string | null;
  partNumber: string | null;
  source: "estimate" | "kit";
  jobLineItemId: string | null;
  estimateLineItemId: string | null;
  kitId: string | null;
  kitVersion: number | null;
  kitQuantity: number | null;
  isOptional: boolean;
}

/** Product-kind line from job_line_items / estimate_line_items. */
export interface SourceLineItem {
  id: string;
  /** Which table it came from. */
  table: "job" | "estimate";
  kind: string;
  name: string;
  qty: number;
  sortOrder: number;
}

/** A kit's CURRENT lines, already loaded, for generate / refresh. */
export interface KitSnapshot {
  kitId: string;
  version: number;
  multiplier: number;
  lines: Array<{
    catalogItemId: string;
    name: string;
    unit: string | null;
    quantity: number;
    isOptional: boolean;
  }>;
}

export interface CatalogMatchItem {
  id: string;
  name: string;
  sku: string | null;
  unit: string | null;
}

/** Normalized-text → catalog item, built once per generation. */
export interface CatalogMatchIndex {
  byName: Map<string, CatalogMatchItem | "ambiguous">;
  bySku: Map<string, CatalogMatchItem>;
  byAlias: Map<string, CatalogMatchItem>;
}

export type CatalogMatchVia = "alias" | "sku" | "name";

export interface PlanGenerationSummary {
  planId: string;
  added: number;
  skipped: number;
  /** Estimate lines that are services/charges, not materials. */
  nonProductSkipped: number;
  needsSku: number;
}

export interface NeedsSkuRow {
  lineId: string;
  jobId: string;
  jobNumber: string | null;
  jobTitle: string | null;
  name: string;
  quantity: number;
  unit: string;
  source: string;
  createdAt: string;
}
