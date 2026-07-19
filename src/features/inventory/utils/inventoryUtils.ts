// ============================================================
// Inventory — Derivation Utils
// Sprint 18
//
// All snapshot views are derived from the core domain objects.
// No component computes readiness or warehouse state independently.
// ============================================================

import type {
  InventoryAllocation,
  InventoryItem,
  InventorySnapshot,
  JobMaterialPlan,
  JobMaterialPlanItem,
  MaterialReadinessState,
  WarehouseJobCard,
  WarehouseJobStatus,
} from "../types/inventory";

// ------------------------------------------------------------------
// Readiness Derivation
// The single source of truth for a job's material readiness state.
// ------------------------------------------------------------------

/**
 * Derives the MaterialReadinessState for a job from its material plan items.
 *
 * Rules:
 * - blocked: any item is in "blocked" state
 * - ready: all items are in loaded, installed, or consumed state
 * - attention_needed: some items are missing, planned without allocation, or only reserved/picked
 */
export function deriveMaterialReadiness(
  items: JobMaterialPlanItem[]
): MaterialReadinessState {
  if (items.length === 0) return "attention_needed";

  const hasBlocked = items.some((item) => item.state === "blocked");
  if (hasBlocked) return "blocked";

  const hasMissing = items.some((item) => item.state === "missing");
  if (hasMissing) return "attention_needed";

  const allReady = items.every(
    (item) =>
      item.state === "loaded" ||
      item.state === "installed" ||
      item.state === "consumed"
  );
  if (allReady) return "ready";

  return "attention_needed";
}

// ------------------------------------------------------------------
// Warehouse Job Status
// Derived from the material plan items for warehouse staff.
// ------------------------------------------------------------------

export function deriveWarehouseJobStatus(
  items: JobMaterialPlanItem[]
): WarehouseJobStatus {
  if (items.length === 0) return "ready_to_pick";

  const hasBlocked = items.some((item) => item.state === "blocked");
  if (hasBlocked) return "blocked";

  const allLoaded = items.every(
    (item) =>
      item.state === "loaded" ||
      item.state === "installed" ||
      item.state === "consumed"
  );
  if (allLoaded) return "loaded";

  const allPickedOrBetter = items.every(
    (item) =>
      item.state === "picked" ||
      item.state === "loaded" ||
      item.state === "installed" ||
      item.state === "consumed"
  );
  if (allPickedOrBetter) return "pick_complete";

  const somePickedOrAllocated = items.some(
    (item) => item.state === "picked" || item.state === "allocated" || item.state === "reserved"
  );
  if (somePickedOrAllocated) {
    const allAllocated = items.every(
      (item) =>
        item.state !== "planned" &&
        item.state !== "missing" &&
        item.state !== "blocked"
    );
    if (allAllocated) return "picking_in_progress";
    return "ready_to_pick";
  }

  return "ready_to_pick";
}

// ------------------------------------------------------------------
// Warehouse Job Card
// ------------------------------------------------------------------

export function buildWarehouseCard(
  plan: JobMaterialPlan
): WarehouseJobCard {
  const status = deriveWarehouseJobStatus(plan.items);
  const specialOrderItems = plan.items.filter((item) => item.isSpecialOrder).length;
  const backorderedItems = plan.items.filter(
    (item) => item.state === "blocked" || item.state === "missing"
  ).length;
  const pickedItems = plan.items.filter(
    (item) =>
      item.state === "picked" ||
      item.state === "loaded" ||
      item.state === "installed" ||
      item.state === "consumed"
  ).length;

  return {
    jobId: plan.jobId,
    jobNumber: plan.jobNumber,
    customerName: plan.customerName,
    propertyName: plan.propertyName,
    scheduledFor: plan.scheduledFor,
    status,
    totalItems: plan.items.length,
    pickedItems,
    specialOrderItems,
    backorderedItems,
    readinessState: plan.readinessState,
  };
}

// ------------------------------------------------------------------
// Snapshot Assembly
// ------------------------------------------------------------------

export function assembleInventorySnapshot(
  inventoryItems: InventoryItem[],
  allocations: InventoryAllocation[],
  materialPlans: JobMaterialPlan[]
): InventorySnapshot {
  const warehouseCards = materialPlans.map(buildWarehouseCard);

  const readyJobs = materialPlans.filter(
    (plan) => plan.readinessState === "ready"
  ).length;
  const attentionNeededJobs = materialPlans.filter(
    (plan) => plan.readinessState === "attention_needed"
  ).length;
  const blockedJobs = materialPlans.filter(
    (plan) => plan.readinessState === "blocked"
  ).length;

  const backordered = inventoryItems.filter((item) => item.isBackordered).length;

  const now = new Date();
  const todayUtc = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;

  const totalItemsToPickToday = materialPlans
    .filter((plan) => plan.scheduledFor <= todayUtc)
    .flatMap((plan) => plan.items)
    .filter(
      (item) =>
        item.state === "allocated" ||
        item.state === "reserved" ||
        item.state === "planned"
    ).length;

  return {
    inventoryItems,
    allocations,
    materialPlans,
    warehouseCards,
    metrics: {
      totalJobsWithPlans: materialPlans.length,
      readyJobs,
      attentionNeededJobs,
      blockedJobs,
      totalItemsToPickToday,
      backordered,
    },
  };
}

// ------------------------------------------------------------------
// Display Helpers
// ------------------------------------------------------------------

export function getReadinessLabel(state: MaterialReadinessState): string {
  switch (state) {
    case "ready":
      return "Ready";
    case "attention_needed":
      return "Attention Needed";
    case "blocked":
      return "Blocked";
  }
}

export function getWarehouseStatusLabel(status: WarehouseJobStatus): string {
  switch (status) {
    case "ready_to_pick":
      return "Ready to Pick";
    case "picking_in_progress":
      return "Picking";
    case "pick_complete":
      return "Pick Complete";
    case "loaded":
      return "Truck Loaded";
    case "blocked":
      return "Blocked";
  }
}

export function getPlanItemStateLabel(
  state: JobMaterialPlanItem["state"]
): string {
  switch (state) {
    case "planned":
      return "Planned";
    case "allocated":
      return "Allocated";
    case "reserved":
      return "Reserved";
    case "picked":
      return "Picked";
    case "loaded":
      return "Loaded";
    case "installed":
      return "Installed";
    case "consumed":
      return "Consumed";
    case "missing":
      return "Missing";
    case "blocked":
      return "Blocked";
  }
}
