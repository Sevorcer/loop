import "server-only";

import { isAppRole } from "@/features/auth/utils/appRole";
import { hasPermission, type AppRole } from "@/services/authorization";
import { getCurrentOperator } from "@/services/currentOperator";

export interface InventoryAccess {
  role: AppRole | null;
  canViewCatalog: boolean;
  canViewStock: boolean;
  canViewLocations: boolean;
  canViewLedger: boolean;
  /** Cost is read only where this is true; never fetch or render it otherwise. */
  canSeeCost: boolean;
  canEditCost: boolean;
  canCreateItems: boolean;
  canEditItems: boolean;
  canPostLedger: boolean;
  canManageLocations: boolean;
  canManageVehicles: boolean;
  canEditPriceTiers: boolean;
  canDeleteTiers: boolean;
  canEditVehicles: boolean;
  canEditLocations: boolean;
  /** Owner, manager, and office. Pars are not a stock-level update. */
  canEditPars: boolean;
  /** Owner, manager, and office may assign who opens a van. */
  canAssignOperators: boolean;
  /** Owner only. Matches vehicle_operators delete. */
  canRemoveOperators: boolean;
  canViewKits: boolean;
  canEditKits: boolean;
  canViewMaterialPlans: boolean;
  canViewArrivals: boolean;
  canEditArrivals: boolean;
  canViewSettings: boolean;
  canEditSettings: boolean;
}

/**
 * Resolves the signed-in user's inventory capabilities from their profile role
 * (user_profiles.app_role, via getCurrentOperator). user_metadata is never read.
 * A missing role grants nothing.
 */
export async function getInventoryAccess(): Promise<InventoryAccess> {
  const { appRole } = await getCurrentOperator();
  const role: AppRole | null = isAppRole(appRole) ? appRole : null;
  const can = (table: Parameters<typeof hasPermission>[1], action: Parameters<typeof hasPermission>[2]) =>
    role !== null && hasPermission(role, table, action);

  return {
    role,
    canViewCatalog: can("catalog_items", "select"),
    canViewStock: can("inventory_stock_levels", "select"),
    canViewLocations: can("inventory_locations", "select"),
    canViewLedger: can("inventory_transactions", "select"),
    canSeeCost: can("catalog_item_costs", "select"),
    canEditCost: can("catalog_item_costs", "update"),
    canCreateItems: can("catalog_items", "insert"),
    canEditItems: can("catalog_items", "update"),
    canPostLedger: can("inventory_transactions", "insert"),
    canManageLocations: can("inventory_locations", "insert"),
    canManageVehicles: can("vehicles", "insert"),
    canEditPriceTiers: can("catalog_price_tiers", "update"),
    canDeleteTiers: can("catalog_price_tiers", "delete"),
    canEditVehicles: can("vehicles", "update"),
    canEditLocations: can("inventory_locations", "update"),
    canEditPars: can("inventory_locations", "update"),
    canAssignOperators: can("vehicle_operators", "insert"),
    canRemoveOperators: can("vehicle_operators", "delete"),
    canViewKits: can("kit_templates", "select"),
    canEditKits: can("kit_templates", "update"),
    canViewMaterialPlans: can("job_material_plans", "select"),
    canViewArrivals: can("inventory_expected_arrivals", "select"),
    canEditArrivals: can("inventory_expected_arrivals", "update"),
    canViewSettings: can("inventory_settings", "select"),
    canEditSettings: can("inventory_settings", "update"),
  };
}

export function firstParam(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && raw.trim() ? raw.trim() : undefined;
}
