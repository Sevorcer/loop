/**
 * Kit templates and inventory settings (Inventory Lane 4, PR A).
 *
 * A kit is a named pallet of consumables/accessories built from the catalog.
 * Kits are SNAPSHOTS once attached to a job (PR B): editing a kit bumps its
 * `version` but never changes jobs that already used it.
 */

export const KIT_STATUSES = ["active", "archived"] as const;
export type KitStatus = (typeof KIT_STATUSES)[number];

export interface KitTemplateLine {
  id: string;
  catalogItemId: string;
  itemName: string;
  sku: string | null;
  unit: string | null;
  itemKind: string;
  /** False when the catalog item was deactivated after the line was added. */
  itemActive: boolean;
  quantity: number;
  isOptional: boolean;
  notes: string | null;
  sortOrder: number;
}

export interface KitTemplateSummary {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  status: KitStatus;
  version: number;
  lineCount: number;
  optionalCount: number;
  updatedAt: string;
}

export interface KitTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  status: KitStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  lines: KitTemplateLine[];
}

export interface KitLineInput {
  catalogItemId: string;
  quantity: number;
  isOptional?: boolean;
  notes?: string | null;
}

/** Only keys that are present change; null clears description/category. */
export interface KitHeaderPatch {
  name?: string;
  description?: string | null;
  category?: string | null;
  status?: KitStatus;
}

/** Picker row for the kit editor: stocked, active catalog items only. */
export interface KitItemOption {
  id: string;
  name: string;
  sku: string | null;
  unit: string | null;
  itemKind: string;
}

export const CLOSEOUT_ENFORCEMENT_STAGES = ["warn", "soft", "hard"] as const;
export type CloseoutEnforcement = (typeof CLOSEOUT_ENFORCEMENT_STAGES)[number];

export interface InventorySettings {
  readinessLeadDays: number;
  arrivalBufferDays: number;
  closeoutEnforcement: CloseoutEnforcement;
  /** True when the org has no saved row yet and these are the built-in defaults. */
  isDefault: boolean;
  updatedAt: string | null;
}

export const DEFAULT_INVENTORY_SETTINGS: InventorySettings = {
  readinessLeadDays: 3,
  arrivalBufferDays: 1,
  closeoutEnforcement: "warn",
  isDefault: true,
  updatedAt: null,
};

export const READINESS_LEAD_DAYS_MAX = 30;
export const ARRIVAL_BUFFER_DAYS_MAX = 14;

export interface InventorySettingsPatch {
  readinessLeadDays?: number;
  arrivalBufferDays?: number;
  closeoutEnforcement?: CloseoutEnforcement;
}
