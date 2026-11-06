import "server-only";

import type { OperatorAssignment } from "@/features/inventory/utils/operatorPlan";
import { planOperatorChanges } from "@/features/inventory/utils/operatorPlan";
import type { VanPerson, VehicleOperator } from "@/features/inventory/types/operators";
import { getVehicle } from "@/repositories/vehicles";
import {
  clearHomeForUser,
  deleteVehicleOperator,
  insertVehicleOperator,
  listTeamMembers,
  listVehicleOperators,
  profileIdsInOrg,
  setVehicleOperatorHome,
} from "@/repositories/vehicleOperators";

function badRequest(message: string): never {
  throw Object.assign(new Error(message), { status: 400 });
}

function notFound(what: string): never {
  throw Object.assign(new Error(`${what} not found.`), { status: 404 });
}

function forbidden(message: string): never {
  throw Object.assign(new Error(message), { status: 403 });
}

export async function listVanOperators(vehicleId?: string): Promise<VehicleOperator[]> {
  return listVehicleOperators(vehicleId);
}

export async function listVanPeople(): Promise<VanPerson[]> {
  return listTeamMembers();
}

/**
 * Replaces the people who open this van. Does not touch crews.vehicle_id.
 * A person has one home van: marking home here clears home on their other van first.
 * Removing someone is owner-only (vehicle_operators delete).
 */
export async function replaceVehicleOperators(
  vehicleId: string,
  desired: readonly OperatorAssignment[],
  options: { canDelete: boolean },
): Promise<void> {
  const vehicle = await getVehicle(vehicleId);
  if (!vehicle) notFound("Vehicle");

  const current = await listVehicleOperators(vehicleId);
  const plan = planOperatorChanges(
    current.map((row) => ({ userId: row.userId, isHome: row.isHome })),
    desired,
  );
  if (plan.problems.length > 0) badRequest(plan.problems[0]);
  if (plan.remove.length > 0 && !options.canDelete) {
    forbidden("Only an owner can remove someone from a van.");
  }

  const wantedIds = desired.map((row) => row.userId.trim()).filter(Boolean);
  const known = await profileIdsInOrg(wantedIds);
  if (wantedIds.some((id) => !known.has(id))) badRequest("That person is not on this team.");

  for (const userId of plan.clearHomeUserIds) {
    await clearHomeForUser(userId, vehicleId);
  }
  for (const userId of plan.remove) {
    await deleteVehicleOperator(vehicleId, userId);
  }
  for (const row of plan.update) {
    await setVehicleOperatorHome(vehicleId, row.userId, row.isHome);
  }
  for (const row of plan.add) {
    await insertVehicleOperator({ vehicleId, userId: row.userId, isHome: row.isHome });
  }
}
