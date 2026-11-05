import { resolveVehicleName, type LinkedVehicleEmbed } from "@/features/inventory/utils/vehicleName";

import type {
  VehicleAlert,
  VehicleAlertPriority,
  VehicleAlertStatus,
} from "../types/vehicleAlert";

export interface VehicleAlertRow {
  id: string;
  org_id: string;
  vehicle_name: string;
  vehicle_id?: string | null;
  vehicle?: LinkedVehicleEmbed;
  title: string;
  description: string;
  priority: VehicleAlertPriority;
  status: VehicleAlertStatus;
  reported_by: string;
  created_at: string;
  updated_at: string;
  reporter?: { full_name: string | null; email: string | null } | null;
}

/** Map a database row (snake_case + optional profile join) to the UI VehicleAlert shape. */
export function mapVehicleAlertRow(row: VehicleAlertRow): VehicleAlert {
  const reportedBy =
    row.reporter?.full_name?.trim() ||
    row.reporter?.email?.trim() ||
    "Unknown";

  return {
    id: row.id,
    vehicleName: resolveVehicleName(row.vehicle, row.vehicle_name),
    vehicleId: row.vehicle_id ?? null,
    title: row.title,
    description: row.description,
    priority: row.priority,
    status: row.status,
    reportedBy,
    reportedAt: row.created_at.slice(0, 10),
  };
}
