import "server-only";

import {
  DEFAULT_INVENTORY_SETTINGS,
  type CloseoutEnforcement,
  type InventorySettings,
  type InventorySettingsPatch,
} from "@/features/inventory/types/kits";
import { throwInventoryDbError } from "./inventoryErrors";
import { getRepositoryContext } from "./supabaseContext";

interface SettingsRow {
  readiness_lead_days: number;
  arrival_buffer_days: number;
  closeout_enforcement: string;
  updated_at: string;
}

const SETTINGS_COLUMNS = "readiness_lead_days,arrival_buffer_days,closeout_enforcement,updated_at";

function mapSettings(row: SettingsRow): InventorySettings {
  return {
    readinessLeadDays: row.readiness_lead_days,
    arrivalBufferDays: row.arrival_buffer_days,
    closeoutEnforcement: row.closeout_enforcement as CloseoutEnforcement,
    isDefault: false,
    updatedAt: row.updated_at,
  };
}

/** Returns the org's saved settings, or the built-in defaults when no row exists yet. */
export async function getInventorySettings(): Promise<InventorySettings> {
  const { supabase, orgId } = await getRepositoryContext();
  const { data, error } = await supabase
    .from("inventory_settings")
    .select(SETTINGS_COLUMNS)
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapSettings(data as SettingsRow) : DEFAULT_INVENTORY_SETTINGS;
}

/** Owner-only (RLS). Creates the row on first save; only the provided columns change afterwards. */
export async function saveInventorySettings(patch: InventorySettingsPatch): Promise<InventorySettings> {
  const { supabase, orgId } = await getRepositoryContext();
  const row: Record<string, unknown> = { org_id: orgId };
  if (patch.readinessLeadDays !== undefined) row.readiness_lead_days = patch.readinessLeadDays;
  if (patch.arrivalBufferDays !== undefined) row.arrival_buffer_days = patch.arrivalBufferDays;

  const { data, error } = await supabase
    .from("inventory_settings")
    .upsert(row, { onConflict: "org_id" })
    .select(SETTINGS_COLUMNS)
    .single();
  if (error) throwInventoryDbError(error);
  return mapSettings(data as SettingsRow);
}
