import "server-only";

import type { InventorySettings } from "@/features/inventory/types/kits";
import { normalizeSettingsPatch } from "@/features/inventory/utils/kitRules";
import { getInventorySettings, saveInventorySettings } from "@/repositories/inventorySettings";

export async function getSettings(): Promise<InventorySettings> {
  return getInventorySettings();
}

export async function updateSettings(input: Record<string, unknown>): Promise<InventorySettings> {
  const result = normalizeSettingsPatch(input);
  if (!result.ok) throw Object.assign(new Error(result.message), { status: 400 });
  return saveInventorySettings(result.value);
}
