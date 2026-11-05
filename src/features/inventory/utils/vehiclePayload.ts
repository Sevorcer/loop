/** Pure request-body parsing for vehicles and locations. */

import { VEHICLE_STATUSES, type VehicleInput, type VehicleStatus } from "../types/ledger";

type Body = Record<string, unknown>;

export interface ParsedVehicle {
  value: Partial<VehicleInput>;
  problems: string[];
}

export function parseVehiclePayload(body: Body): ParsedVehicle {
  const problems: string[] = [];
  const out: Record<string, unknown> = {};

  for (const key of ["name", "plate", "vin", "notes"]) {
    if (!(key in body)) continue;
    const raw = body[key];
    if (typeof raw === "string") out[key] = raw;
    else if (raw === null && key !== "name") out[key] = null;
    else problems.push(`${key} must be text.`);
  }
  if ("crewId" in body) {
    if (body.crewId === null || typeof body.crewId === "string") out.crewId = body.crewId;
    else problems.push("crewId must be an id or null.");
  }
  if ("status" in body) {
    if (typeof body.status === "string" && VEHICLE_STATUSES.includes(body.status as VehicleStatus)) out.status = body.status;
    else problems.push(`status must be one of: ${VEHICLE_STATUSES.join(", ")}.`);
  }
  return { value: out as Partial<VehicleInput>, problems };
}
