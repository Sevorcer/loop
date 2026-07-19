// ============================================================
// Inventory — Type System
// Sprint 18
//
// Material Readiness is the operational concept.
// Inventory exists to answer one question: "Can this work actually happen?"
//
// The domain model flows:
//   InventoryItem → InventoryAllocation → JobMaterialPlan → Work Order
// ============================================================

// ------------------------------------------------------------------
// Core Enumerations
// ------------------------------------------------------------------

export type InventoryItemCategory =
  | "Equipment"
  | "Accessory"
  | "Part"
  | "Consumable"
  | "Material";

/**
 * The lifecycle progression of a reserved inventory allocation.
 * Material state matters more than quantity alone.
 */
export type MaterialAllocationState =
  | "reserved"
  | "picked"
  | "loaded"
  | "installed"
  | "consumed";

/**
 * The operational state of a single line item in a job material plan.
 */
export type MaterialPlanItemState =
  | "planned"
  | "allocated"
  | "reserved"
  | "picked"
  | "loaded"
  | "installed"
  | "consumed"
  | "missing"
  | "blocked";

/**
 * The top-level material readiness for a job.
 * This is what managers see at a glance.
 */
export type MaterialReadinessState =
  | "ready"
  | "attention_needed"
  | "blocked";

// ------------------------------------------------------------------
// Inventory Item
// The physical stockable unit.
// ------------------------------------------------------------------

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: InventoryItemCategory;
  description: string;
  /** Unit of measure: "each", "lbs", "ft", "gal", etc. */
  unit: string;
  quantityOnHand: number;
  quantityReserved: number;
  /** Derived: onHand - reserved */
  quantityAvailable: number;
  warehouseLocation?: string;
  isSpecialOrder: boolean;
  isBackordered: boolean;
  /** ISO date string — expected arrival when backordered */
  expectedArrival?: string;
}

// ------------------------------------------------------------------
// Inventory Allocation
// The commitment of a specific inventory item to a specific job.
// Not just quantity on hand — whether the material is reserved for work.
// ------------------------------------------------------------------

export interface InventoryAllocation {
  id: string;
  inventoryItemId: string;
  jobId: string;
  jobNumber: string;
  quantity: number;
  state: MaterialAllocationState;
  /** ISO timestamp */
  allocatedAt: string;
  pickedAt?: string;
  loadedAt?: string;
  installedAt?: string;
  notes?: string;
}

// ------------------------------------------------------------------
// Job Material Plan — Item
// A single required material within a job material plan.
// ------------------------------------------------------------------

export interface JobMaterialPlanItem {
  id: string;
  materialPlanId: string;
  /** Reference to an InventoryItem, if this item exists in inventory */
  inventoryItemId?: string;
  /** Display name (may differ from InventoryItem name for context) */
  itemName: string;
  category: InventoryItemCategory;
  quantityRequired: number;
  /** Link to the actual InventoryAllocation when committed */
  allocationId?: string;
  state: MaterialPlanItemState;
  isSpecialOrder: boolean;
  notes?: string;
}

// ------------------------------------------------------------------
// Job Material Plan
// The complete set of materials required to complete a job.
// This is the operational checklist for warehouse and installers.
// ------------------------------------------------------------------

export interface JobMaterialPlan {
  id: string;
  jobId: string;
  jobNumber: string;
  customerName: string;
  propertyName: string;
  scheduledFor: string;
  readinessState: MaterialReadinessState;
  items: JobMaterialPlanItem[];
  /** ISO timestamp when the plan was generated */
  generatedAt: string;
  /** ISO timestamp when the plan was last updated */
  lastUpdated: string;
}

// ------------------------------------------------------------------
// Inventory Event Types
// Emitted by the Inventory domain. Live Operations can observe these
// without owning inventory logic.
// ------------------------------------------------------------------

export type InventoryEventType =
  | "materials_reserved"
  | "parts_picked"
  | "truck_loaded"
  | "missing_equipment"
  | "backorder_created"
  | "emergency_part_delivered";

// ------------------------------------------------------------------
// Warehouse View
// Derived view for warehouse staff: what needs to happen today.
// ------------------------------------------------------------------

export type WarehouseJobStatus =
  | "ready_to_pick"
  | "picking_in_progress"
  | "pick_complete"
  | "loaded"
  | "blocked";

export interface WarehouseJobCard {
  jobId: string;
  jobNumber: string;
  customerName: string;
  propertyName: string;
  scheduledFor: string;
  status: WarehouseJobStatus;
  totalItems: number;
  pickedItems: number;
  specialOrderItems: number;
  backorderedItems: number;
  readinessState: MaterialReadinessState;
}

// ------------------------------------------------------------------
// Snapshot — the assembled result passed to InventoryScreen
// ------------------------------------------------------------------

export interface InventorySnapshot {
  inventoryItems: InventoryItem[];
  allocations: InventoryAllocation[];
  materialPlans: JobMaterialPlan[];
  warehouseCards: WarehouseJobCard[];
  /** Counts for hero metrics */
  metrics: {
    totalJobsWithPlans: number;
    readyJobs: number;
    attentionNeededJobs: number;
    blockedJobs: number;
    totalItemsToPickToday: number;
    backordered: number;
  };
}
