import "server-only";

import type {
  VehicleAlert,
  VehicleAlertPriority,
  VehicleAlertStatus,
} from "@/features/vehicle-alerts/types/vehicleAlert";
import { ALERT_VEHICLE_EMBED } from "@/features/inventory/utils/vehicleName";
import { mapVehicleAlertRow, type VehicleAlertRow } from "@/features/vehicle-alerts/utils/mapVehicleAlert";
import {
  getRepositoryContext,
  type SessionRepositoryContextInput,
} from "./supabaseContext";

const VEHICLE_ALERT_SELECT =
  `id,org_id,${ALERT_VEHICLE_EMBED},title,description,priority,status,reported_by,created_at,updated_at,reporter:user_profiles!vehicle_alerts_reported_by_fkey(full_name,email)`;

export interface VehicleAlertCreateInput {
  /** The vehicle the alert is about (vehicle_alerts.vehicle_id is NOT NULL). */
  vehicleId: string;
  title: string;
  description: string;
  priority: VehicleAlertPriority;
  reportedByUserId: string;
}

export async function listVehicleAlerts(
  ctx?: SessionRepositoryContextInput,
): Promise<VehicleAlert[]> {
  const { supabase, orgId } = await getRepositoryContext(ctx);

  const { data, error } = await supabase
    .from("vehicle_alerts")
    .select(VEHICLE_ALERT_SELECT)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) {
    throw Object.assign(new Error(error.message), { status: 500 });
  }

  return ((data ?? []) as unknown as VehicleAlertRow[]).map(mapVehicleAlertRow);
}

export async function createVehicleAlertRecord(
  input: VehicleAlertCreateInput,
  ctx?: SessionRepositoryContextInput,
): Promise<VehicleAlert> {
  const { supabase, orgId } = await getRepositoryContext(ctx);

  const { data, error } = await supabase
    .from("vehicle_alerts")
    .insert({
      org_id: orgId,
      vehicle_id: input.vehicleId,
      title: input.title,
      description: input.description,
      priority: input.priority,
      status: "New",
      reported_by: input.reportedByUserId,
    })
    .select(VEHICLE_ALERT_SELECT)
    .single();

  if (error) {
    throw Object.assign(new Error(error.message), { status: 500 });
  }

  return mapVehicleAlertRow(data as unknown as VehicleAlertRow);
}

export async function updateVehicleAlertStatusRecord(
  id: string,
  status: VehicleAlertStatus,
  ctx?: SessionRepositoryContextInput,
): Promise<VehicleAlert | null> {
  const { supabase, orgId } = await getRepositoryContext(ctx);

  const { data, error } = await supabase
    .from("vehicle_alerts")
    .update({ status })
    .eq("org_id", orgId)
    .eq("id", id)
    .select(VEHICLE_ALERT_SELECT)
    .maybeSingle();

  if (error) {
    throw Object.assign(new Error(error.message), { status: 500 });
  }

  return data ? mapVehicleAlertRow(data as unknown as VehicleAlertRow) : null;
}
