/** Pure request-body parsing for vehicles and locations. */

import type { OperatorAssignment } from "./operatorPlan";
import { VEHICLE_STATUSES, type VehicleInput, type VehicleStatus } from "../types/ledger";

type Body = Record<string, unknown>;

export interface ParsedVehicle {
  value: Partial<VehicleInput>;
  /** Present only when the request included `operators`. */
  operators?: OperatorAssignment[];
  /** Present only when the request included `ensureLocation`. */
  ensureLocation?: boolean;
  problems: string[];
}

function parseOperators(raw: unknown, problems: string[]): OperatorAssignment[] | undefined {
  if (!Array.isArray(raw)) {
    problems.push("operators must be a list.");
    return undefined;
  }
  const operators: OperatorAssignment[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") {
      problems.push("Each person needs an id.");
      continue;
    }
    const record = entry as Record<string, unknown>;
    if (typeof record.userId !== "string" || !record.userId.trim()) {
      problems.push("Each person needs an id.");
      continue;
    }
    if (typeof record.isHome !== "boolean") {
      problems.push("Say whether this van is their home van.");
      continue;
    }
    operators.push({ userId: record.userId.trim(), isHome: record.isHome });
  }
  return operators;
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

  let operators: OperatorAssignment[] | undefined;
  if ("operators" in body) operators = parseOperators(body.operators, problems);

  let ensureLocation: boolean | undefined;
  if ("ensureLocation" in body) {
    if (typeof body.ensureLocation === "boolean") ensureLocation = body.ensureLocation;
    else problems.push("ensureLocation must be true or false.");
  }

  return {
    value: out as Partial<VehicleInput>,
    ...(operators ? { operators } : {}),
    ...(ensureLocation !== undefined ? { ensureLocation } : {}),
    problems,
  };
}
