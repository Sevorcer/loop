import "server-only";

import type {
  VehicleAlert,
  VehicleAlertPriority,
  VehicleAlertStatus,
} from "@/features/vehicle-alerts/types/vehicleAlert";
import {
  createVehicleAlertRecord,
  listVehicleAlerts as listVehicleAlertRecords,
  updateVehicleAlertStatusRecord,
} from "@/repositories/vehicleAlerts";
import type { SessionRepositoryContextInput } from "@/repositories/supabaseContext";

const PRIORITIES = new Set<VehicleAlertPriority>(["Low", "Medium", "High"]);
const STATUSES = new Set<VehicleAlertStatus>([
  "New",
  "Acknowledged",
  "Scheduled",
  "Resolved",
]);

export function isVehicleAlertPriority(value: unknown): value is VehicleAlertPriority {
  return typeof value === "string" && PRIORITIES.has(value as VehicleAlertPriority);
}

export function isVehicleAlertStatus(value: unknown): value is VehicleAlertStatus {
  return typeof value === "string" && STATUSES.has(value as VehicleAlertStatus);
}

export interface CreateVehicleAlertServiceInput {
  vehicleName: string;
  title: string;
  description: string;
  priority: VehicleAlertPriority;
  reportedByUserId: string;
}

function validateCreateInput(input: CreateVehicleAlertServiceInput) {
  if (!input.vehicleName.trim()) throw Object.assign(new Error("vehicleName is required."), { status: 400 });
  if (!input.title.trim()) throw Object.assign(new Error("title is required."), { status: 400 });
  if (!input.description.trim()) throw Object.assign(new Error("description is required."), { status: 400 });
  if (!PRIORITIES.has(input.priority)) {
    throw Object.assign(new Error("priority must be Low, Medium, or High."), { status: 400 });
  }
  if (!input.reportedByUserId) {
    throw Object.assign(new Error("Authenticated user is required."), { status: 401 });
  }
}

export async function listVehicleAlerts(
  ctx?: SessionRepositoryContextInput,
): Promise<VehicleAlert[]> {
  return listVehicleAlertRecords(ctx);
}

export async function createVehicleAlert(
  input: CreateVehicleAlertServiceInput,
  ctx?: SessionRepositoryContextInput,
): Promise<VehicleAlert> {
  validateCreateInput(input);
  return createVehicleAlertRecord(
    {
      vehicleName: input.vehicleName.trim(),
      title: input.title.trim(),
      description: input.description.trim(),
      priority: input.priority,
      reportedByUserId: input.reportedByUserId,
    },
    ctx,
  );
}

export async function updateVehicleAlertStatus(
  id: string,
  status: VehicleAlertStatus,
  ctx?: SessionRepositoryContextInput,
): Promise<VehicleAlert> {
  if (!id) throw Object.assign(new Error("id is required."), { status: 400 });
  if (!STATUSES.has(status)) {
    throw Object.assign(
      new Error("status must be New, Acknowledged, Scheduled, or Resolved."),
      { status: 400 },
    );
  }

  const updated = await updateVehicleAlertStatusRecord(id, status, ctx);
  if (!updated) {
    throw Object.assign(new Error("Vehicle alert not found."), { status: 404 });
  }
  return updated;
}
